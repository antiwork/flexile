# frozen_string_literal: true

RSpec.describe ConsolidatedPayment do
  describe "associations" do
    it { is_expected.to belong_to(:consolidated_invoice) }
    it { is_expected.to have_many(:integration_records) }
    it { is_expected.to have_many(:balance_transactions).class_name("ConsolidatedPaymentBalanceTransaction") }
  end

  describe "validations" do
    it { is_expected.to validate_presence_of(:status) }
    it { is_expected.to validate_inclusion_of(:status).in_array(ConsolidatedPayment::ALL_STATUSES) }
    it { is_expected.to validate_numericality_of(:stripe_fee_cents).is_greater_than(1).only_integer.allow_nil }
  end

  describe "delegations" do
    it { is_expected.to delegate_method(:company).to(:consolidated_invoice) }
  end

  describe "scopes" do
    describe ".successful" do
      it "returns payments with succeeded status" do
        (ConsolidatedPayment::ALL_STATUSES - [ConsolidatedPayment::SUCCEEDED]).each do |status|
          create(:consolidated_payment, status:)
        end
        successful = create_list(:consolidated_payment, 2, status: Payment::SUCCEEDED)

        expect(described_class.successful).to match_array successful
      end
    end
  end

  describe "callbacks" do
    describe "#sync_with_quickbooks" do
      let!(:consolidated_payment) { create(:consolidated_payment) }

      [ConsolidatedPayment::INITIAL, ConsolidatedPayment::FAILED, ConsolidatedPayment::CANCELLED].each do |status|
        context "when a consolidated payment is being marked as #{status}" do
          let(:status) { status }

          it "does not schedule a Quickbooks data sync job" do
            expect do
              consolidated_payment.update!(status:)
            end.to_not change { QuickbooksDataSyncJob.jobs.size }
          end
        end
      end

      it "enqueues a QuickbooksDataSyncJob when the status changes to SUCCEEDED" do
        expect do
          consolidated_payment.update!(status: ConsolidatedPayment::SUCCEEDED)
        end.to change(QuickbooksDataSyncJob.jobs, :size).by(1)
      end
    end
  end

  describe "#stripe_payment_intent" do
    let(:consolidated_payment) { create(:consolidated_payment) }

    it "returns the Stripe::PaymentIntent when an id is present", :vcr do
      consolidated_payment.stripe_payment_intent_id = "pi_3LaEP8FSsGLfTpet1eJw3aVf"

      stripe_payment_intent = consolidated_payment.stripe_payment_intent

      expect(stripe_payment_intent).to be_a(Stripe::PaymentIntent)
      expect(stripe_payment_intent.id).to eq("pi_3LaEP8FSsGLfTpet1eJw3aVf")
    end

    it "returns nil when an id is not present" do
      expect(consolidated_payment.stripe_payment_intent).to be_nil
    end
  end

  describe "#refundable?" do
    let(:invoice) { create(:invoice, status: Invoice::APPROVED) }
    let(:consolidated_invoice) { create(:consolidated_invoice, invoices: [invoice]) }
    let(:consolidated_payment) { create(:consolidated_payment, consolidated_invoice:) }

    (ConsolidatedPayment::ALL_STATUSES - ConsolidatedPayment::REFUNDABLE_STATUSES).each do |status|
      context "when status is #{status}" do
        it "returns false regardless of invoice status" do
          consolidated_payment.update!(status:)
          expect(consolidated_payment.refundable?).to be false
        end
      end
    end

    ConsolidatedPayment::REFUNDABLE_STATUSES.each do |status|
      context "when status is #{status}" do
        it "returns true when there are no paid or mid-payment invoices" do
          consolidated_payment.update!(status:)

          invoice.update!(status: Invoice::PAID)
          expect(consolidated_payment.refundable?).to be false

          invoice.update!(status: Invoice::PAYMENT_PENDING)
          expect(consolidated_payment.refundable?).to be false

          invoice.update!(status: Invoice::PROCESSING)
          expect(consolidated_payment.refundable?).to be false

          invoice.update!(status: Invoice::APPROVED)
          expect(consolidated_payment.refundable?).to be true
        end
      end
    end
  end

  describe "#mark_as_refunded!" do
    let(:consolidated_payment) { create(:consolidated_payment, :succeeded) }

    it "updates the consolidated payment and consolidated invoice status to refunded" do
      expect do
        consolidated_payment.mark_as_refunded!
      end.to change { consolidated_payment.reload.status }.from(ConsolidatedPayment::SUCCEEDED).to(ConsolidatedPayment::REFUNDED)
        .and change { consolidated_payment.consolidated_invoice.status }.from(ConsolidatedInvoice::PAID).to(ConsolidatedInvoice::REFUNDED)
    end
  end

  describe "#marked_failed?" do
    it "returns `true` if status is failed" do
      payment = build(:consolidated_payment)
      expect(payment.marked_failed?).to eq(false)

      payment.status = ConsolidatedPayment::FAILED
      expect(payment.marked_failed?).to eq(true)
    end
  end
end
