# frozen_string_literal: true

RSpec.describe WiseTransferUpdateJob do
  describe "#perform" do
    let(:company) { create(:company) }
    let(:user) { create(:user) }
    let(:company_contractor) { create(:company_contractor, company: company, user: user) }
    let(:invoice) { create(:invoice, company: company, user: user) }
    let(:wise_credential) { create(:wise_credential) }
    let(:payment) { create(:payment, invoice: invoice, wise_credential: wise_credential, wise_transfer_id: "transfer_123") }
    let(:transfer_id) { payment.wise_transfer_id }
    let(:payout_api) { instance_double(Wise::PayoutApi) }

    before do
      allow(Wise::PayoutApi).to receive(:new).and_return(payout_api)
      allow(payout_api).to receive(:get_transfer).and_return({ "sourceValue" => 100.0, "targetValue" => 95.0, "targetCurrency" => "USD" })
      allow(payout_api).to receive(:delivery_estimate).and_return({ "estimatedDeliveryDate" => "2025-08-10T12:00:00Z" })
    end

    context "when payment fails" do
      let(:webhook_params) do
        {
          "data" => {
            "resource" => {
              "id" => transfer_id,
              "profile_id" => wise_credential.profile_id,
            },
            "current_state" => Payments::Wise::CANCELLED,
            "occurred_at" => "2025-08-07T10:00:00Z",
          },
        }
      end

      it "updates the payment status and sends a notification" do
        expect do
          described_class.new.perform(webhook_params)
        end.to have_enqueued_mail(CompanyWorkerMailer, :payment_failed).with { |payment_id, amount, currency|
          expect(payment_id).to eq(payment.id)
          expect(amount).to eq(95.0)
          expect(currency).to eq("USD")
        }

        payment.reload
        invoice.reload

        expect(payment.status).to eq(Payment::FAILED)
        expect(payment.wise_transfer_status).to eq(Payments::Wise::CANCELLED)
        expect(invoice.status).to eq(Invoice::FAILED)
      end
    end

    context "when payment succeeds" do
      let(:webhook_params) do
        {
          "data" => {
            "resource" => {
              "id" => transfer_id,
              "profile_id" => wise_credential.profile_id,
            },
            "current_state" => Payments::Wise::OUTGOING_PAYMENT_SENT,
            "occurred_at" => "2025-08-07T10:00:00Z",
          },
        }
      end

      it "updates the payment status and does not send a failure notification" do
        expect do
          described_class.new.perform(webhook_params)
        end.not_to have_enqueued_mail(CompanyWorkerMailer, :payment_failed)

        payment.reload
        invoice.reload

        expect(payment.status).to eq(Payment::SUCCEEDED)
        expect(payment.wise_transfer_status).to eq(Payments::Wise::OUTGOING_PAYMENT_SENT)
        expect(invoice.status).to eq(Invoice::PAID)
      end
    end
  end
end
