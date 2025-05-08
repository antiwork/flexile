# frozen_string_literal: true

RSpec.describe Stripe::EventHandler do
  include StripeHelpers

  let(:stripe_payment_intent_id) { "pi_3LXaVWFSsGLfTpet0czoRTcy" }

  describe "setup_intent events" do
    context "when event type is setup_intent.succeeded", :vcr do
      before { setup_company_on_stripe(company_stripe_account.company) }

      let(:company_stripe_account) { create(:company_stripe_account, :initial) }
      let(:stripe_event) do
        Stripe::Event.construct_from(
          type: "setup_intent.succeeded",
          data: {
            object: {
              id: company_stripe_account.setup_intent_id,
            },
          }
        )
      end

      it "sets the status and bank_account_last_four for the company stripe account" do
        expect do
          described_class.new(stripe_event).process!
        end.to change { company_stripe_account.reload.status }.from("initial").to("ready")
           .and change { company_stripe_account.bank_account_last_four }.from(nil).to("6789")
      end
    end

    context "when event type is setup_intent.requires_action", :vcr do
      let(:company_stripe_account) { create(:company_stripe_account, :initial) }
      let(:company) { company_stripe_account.company }
      let(:data) { { object: { id: company_stripe_account.setup_intent_id } } }
      let(:stripe_event) { Stripe::Event.construct_from(type: "setup_intent.requires_action", data:) }

      it "sets the status and bank_account_last_four for the company stripe account" do
        expect do
          described_class.new(stripe_event).process!
        end.to change { company_stripe_account.reload.status }.from("initial").to("action_required")
           .and change { company_stripe_account.bank_account_last_four }.from(nil).to("6789")
      end

      context "when the company requires microdeposit verification" do
        before { setup_company_on_stripe(company) }

        context "via descriptor code" do
          let(:data) do
            {
              object: {
                id: company_stripe_account.setup_intent_id,
                status: "requires_action",
                next_action: {
                  type: "verify_with_microdeposits",
                  verify_with_microdeposits: {
                    microdeposit_type: "descriptor_code",
                    arrival_date: Time.new(2024, 5, 7).to_i,
                  },
                },
              },
            }
          end
          let!(:admin) { create(:company_administrator, company:) }

          it "emails the company admins" do
            expect do
              described_class.new(stripe_event).process!
            end.to have_enqueued_mail(CompanyMailer, :verify_stripe_microdeposits).with(admin_id: admin.id)
          end
        end

        context "via amounts" do
          let(:data) do
            {
              object: {
                id: company_stripe_account.setup_intent_id,
                status: "requires_action",
                next_action: {
                  type: "verify_with_microdeposits",
                  verify_with_microdeposits: {
                    microdeposit_type: "amounts",
                    arrival_date: Time.new(2024, 5, 7).to_i,
                  },
                },
              },
            }
          end
          let!(:admin) { create(:company_administrator, company:) }

          it "emails the company admins" do
            expect do
              described_class.new(stripe_event).process!
            end.to have_enqueued_mail(CompanyMailer, :verify_stripe_microdeposits).with(admin_id: admin.id)
          end
        end
      end
    end

    context "when event type is setup_intent.canceled" do
      let(:company_stripe_account) { create(:company_stripe_account) } # unlikely it would start as 'ready'; just for testing purposes
      let(:stripe_event) do
        Stripe::Event.construct_from(
          type: "setup_intent.canceled",
          data: { object: { id: company_stripe_account.setup_intent_id } },
        )
      end

      it "sets the status and deletes the company stripe account", :freeze_time do
        expect(Bugsnag).to receive(:notify)

        expect do
          described_class.new(stripe_event).process!
        end.to change { company_stripe_account.reload.status }.from("ready").to("cancelled")
           .and change { company_stripe_account.deleted_at }.from(nil).to(Time.current)
      end
    end

    context "when event type is setup_intent.failed" do
      let(:company_stripe_account) { create(:company_stripe_account) } # unlikely it would start as 'ready'; just for testing purposes
      let(:company) { company_stripe_account.company }
      let!(:company_administrator) { create(:company_administrator, company:) }
      let(:last_setup_error) { nil }
      let(:stripe_event) do
        Stripe::Event.construct_from(
          type: "setup_intent.setup_failed",
          data: { object: { id: company_stripe_account.setup_intent_id, last_setup_error: } },
        )
      end
      let(:failed_setup_intent_id) { company_stripe_account.setup_intent_id }

      it "sets the status on the company stripe account", :freeze_time do
        expect(Bugsnag).to receive(:notify)

        expect do
          described_class.new(stripe_event).process!
        end.to change { company_stripe_account.reload.status }.from("ready").to("failed")
      end

      context "with microdeposit verification not completed in time" do
        let(:last_setup_error) { { code: "setup_intent_setup_attempt_expired" } }

        it "also sets the status, deletes the company stripe account, and emails company administrators", :freeze_time do
          expect(Bugsnag).to receive(:notify)

          expect do
            described_class.new(stripe_event).process!
          end.to change { company_stripe_account.reload.status }.from("ready").to("failed")
             .and change { company_stripe_account.deleted_at }.from(nil).to(Time.current)
             .and have_enqueued_mail(CompanyMailer, :stripe_microdeposit_verification_expired).with(admin_id: company_administrator.id)
        end
      end

      context "with another error" do
        let(:last_setup_error) do
          {
            type: "invalid_request_error",
            message: "Microdeposit transfers have been blocked. Please contact us at https://support.stripe.com/ if you would like more information.",
          }
        end

        it "sets the status and deletes the company stripe account", :freeze_time do
          expect(Bugsnag).to receive(:notify)

          expect do
            described_class.new(stripe_event).process!
          end.to change { company_stripe_account.reload.status }.from("ready").to("failed")
             .and change { company_stripe_account.deleted_at }.from(nil).to(Time.current)
        end
      end
    end
  end

  describe "charge events" do
    context "when event type is charge.refund" do
      let!(:consolidated_payment) do
        create(:consolidated_payment, :succeeded, stripe_payment_intent_id:)
      end
      let(:stripe_event) do
        Stripe::Event.construct_from(
          type: "charge.refunded",
          data: { object: { payment_intent: stripe_payment_intent_id } },
        )
      end

      it "marks the consolidated payment and its consolidated invoice as refunded" do
        expect do
          described_class.new(stripe_event).process!
        end.to change { consolidated_payment.reload.status }.from("succeeded").to("refunded")
           .and change { consolidated_payment.consolidated_invoice.status }.from("paid").to("refunded")
      end

      it "raises an exception if a matching consolidated payment isn't found" do
        consolidated_payment.destroy!

        expect do
          described_class.new(stripe_event).process!
        end.to raise_error(ActiveRecord::RecordNotFound)
      end
    end
  end

  describe "payout events" do
    RSpec.shared_examples_for "processes payout event" do
      let(:automatic) { false }
      let(:stripe_payout_id) { "po_1FJ7Z7kXxX7Z7kX" }
      let!(:consolidated_payment) { create(:consolidated_payment, stripe_payout_id:) }
      let(:payout_metadata) do
        {
          consolidated_invoice: consolidated_invoice.id,
          consolidated_payment: consolidated_payment.id,
        }
      end
      let(:consolidated_invoice) { consolidated_payment.consolidated_invoice }
      let(:payout_metadata) do
        {
          consolidated_invoice: consolidated_invoice.id,
          consolidated_payment: consolidated_payment.id,
        }
      end
      let(:stripe_event) do
        Stripe::Event.construct_from(
          type: "payout.paid",
          data: {
            object: {
              id: stripe_payout_id,
              automatic:,
              metadata: payout_metadata,
            },
          }
        )
      end

      it "enqueues background job" do
        described_class.new(stripe_event).process!
        expect(ProcessPayoutForConsolidatedPaymentJob).to have_enqueued_sidekiq_job(consolidated_payment.id)
      end

      context "when the payout was initiated automatically" do
        let(:automatic) { true }

        it "does not enqueue background job" do
          described_class.new(stripe_event).process!
          expect(ProcessPayoutForConsolidatedPaymentJob).not_to have_enqueued_sidekiq_job
        end
      end

      context "when the payout was not initiated by Flexile" do
        let(:payout_metadata) { Hash.new }

        it "does not enqueue background job" do
          described_class.new(stripe_event).process!
          expect(ProcessPayoutForConsolidatedPaymentJob).not_to have_enqueued_sidekiq_job
        end
      end

      context "when the consolidated payment is not found" do
        it "raises an exception" do
          consolidated_payment.destroy!

          expect do
            described_class.new(stripe_event).process!
          end.to raise_error(ActiveRecord::RecordNotFound)
        end
      end
    end

    %w(
      payout.paid
    ).each do |event_type|
      context "when event type is #{event_type}" do
        let(:event_type) { event_type }

        it_behaves_like "processes payout event"
      end
    end

    context "when event type is payout.paid" do
      let(:automatic) { false }
      let(:stripe_payout_id) { "po_1FJ7Z7kXxX7Z7kX" }
      let!(:consolidated_payment) { create(:consolidated_payment, stripe_payout_id:) }
      let(:payout_metadata) do
        {
          consolidated_invoice: consolidated_invoice.id,
          consolidated_payment: consolidated_payment.id,
        }
      end
      let(:consolidated_invoice) { consolidated_payment.consolidated_invoice }
      let(:stripe_event) do
        Stripe::Event.construct_from(
          type: "payout.paid",
          data: {
            object: {
              id: stripe_payout_id,
              automatic:,
              metadata: payout_metadata,
            },
          }
        )
      end
    end
  end

  describe "payment_intent events" do
    RSpec.shared_examples_for "processes payment intent event" do
      let!(:consolidated_payment) { create(:consolidated_payment, stripe_payment_intent_id:) }
      let(:stripe_event) do
        Stripe::Event.construct_from(
          type: event_type,
          data: {
            object: {
              id: stripe_payment_intent_id,
            },
          }
        )
      end

      it "enqueues background job" do
        described_class.new(stripe_event).process!
        expect(ProcessPaymentIntentForConsolidatedPaymentJob).to have_enqueued_sidekiq_job(consolidated_payment.id)
      end

      context "when the consolidated payment is not found" do
        it "raises an exception" do
          consolidated_payment.destroy!

          expect do
            described_class.new(stripe_event).process!
          end.to raise_error(ActiveRecord::RecordNotFound)
        end
      end
    end

    %w(
      payment_intent.succeeded
      payment_intent.payment_failed
      payment_intent.canceled
    ).each do |event_type|
      context "when event type is #{event_type}" do
        let(:event_type) { event_type }

        it_behaves_like "processes payment intent event"
      end
    end
  end
end
