# frozen_string_literal: true

require "shared_examples/wise_payment_examples"

RSpec.describe Payment do
  include_examples "Wise payments" do
    let(:allows_other_payment_methods) { false }
    let(:payment) { build(:payment) }
  end

  describe "associations" do
    it { is_expected.to belong_to(:invoice) }
    it { is_expected.to have_many(:balance_transactions).class_name("PaymentBalanceTransaction") }
    it { is_expected.to have_many(:integration_records) }
  end

  describe "validations" do
    it { is_expected.to validate_presence_of(:status) }
    it { is_expected.to validate_inclusion_of(:status).in_array(Payment::DEFAULT_STATUSES) }
    it { is_expected.to validate_presence_of(:net_amount_in_cents) }
    it { is_expected.to validate_numericality_of(:net_amount_in_cents).is_greater_than_or_equal_to(1).only_integer }
    it { is_expected.to validate_numericality_of(:transfer_fee_in_cents).is_greater_than_or_equal_to(0).only_integer.allow_nil }
  end

  describe "delegations" do
    it { is_expected.to delegate_method(:company).to(:invoice) }
    it { is_expected.to delegate_method(:integration_external_id).to(:quickbooks_integration_record) }
    it { is_expected.to delegate_method(:sync_token).to(:quickbooks_integration_record) }
  end

  describe "scopes" do
    describe ".successful" do
      it "returns payments with succeeded status" do
        (Payment::DEFAULT_STATUSES - [Payment::SUCCEEDED]).each do |status|
          create(:payment, status:)
        end
        successful = create_list(:payment, 2, status: Payment::SUCCEEDED)
        expect(described_class.successful).to match_array successful
      end
    end
  end

  describe "#marked_failed?" do
    it "returns `true` if status is failed" do
      payment = build(:payment)
      expect(payment.marked_failed?).to eq(false)

      payment.status = Payment::FAILED
      expect(payment.marked_failed?).to eq(true)
    end
  end

  describe "callbacks" do
    describe "#sync_with_quickbooks" do
      let(:company) { create(:company) }
      let!(:integration) { create(:quickbooks_integration, company:) }
      let(:contractor) { create(:company_worker, company:) }
      let(:invoice) { create(:invoice, company:, user: contractor.user) }
      let!(:invoice_integration_record) { create(:integration_record, integratable: invoice, integration:) }
      let(:payment) { create(:payment, invoice:) }

      [Payment::INITIAL, Payment::FAILED, Payment::CANCELLED].each do |status|
        context "when a payment is being marked as #{status}" do
          let(:status) { status }

          it "does not schedule a Quickbooks data sync job" do
            expect do
              payment.update!(status:)
            end.to_not change { QuickbooksDataSyncJob.jobs.size }
          end
        end
      end

      context "when a payment has succeeded" do
        it "schedules a QuickBooks data sync job" do
          expect do
            payment.update!(status: Payment::SUCCEEDED)
          end.to change { QuickbooksDataSyncJob.jobs.size }.by(1)

          expect(QuickbooksDataSyncJob).to have_enqueued_sidekiq_job(company.id, "Payment", payment.id)
        end
      end
    end
  end

  describe "#wise_transfer_reference" do
    it "returns the reference" do
      expect(build(:payment).wise_transfer_reference).to eq("PMT")
    end
  end

  describe "#quickbooks_entity" do
    it "returns the QuickBooks entity name" do
      expect(build(:payment).quickbooks_entity).to eq("BillPayment")
    end
  end

  describe "#create_or_update_integration_record!", :freeze_time do
    let(:company) { create(:company) }
    let!(:integration) { create(:quickbooks_integration, company:) }
    let(:contractor) { create(:company_worker, company:) }
    let(:invoice) { create(:invoice, company:, user: contractor.user) }
    let!(:invoice_integration_record) { create(:integration_record, integratable: invoice, integration:) }
    let(:payment) { create(:payment, invoice:, status: Payment::INITIAL) }

    context "when no integration record exists for the payment" do
      it "creates a new integration record for the payment" do
        expect do
          payment.create_or_update_quickbooks_integration_record!(integration:, parsed_body: { "Id" => "1", "SyncToken" => "0" })
        end.to change { IntegrationRecord.count }.by(1)
        .and change { integration.reload.last_sync_at }.from(nil).to(Time.current)

        integration_record = payment.reload.quickbooks_integration_record
        expect(integration_record.integration_external_id).to eq("1")
        expect(integration_record.sync_token).to eq("0")
      end
    end

    context "when an integration record exists for the payment" do
      let!(:integration_record) { create(:integration_record, integratable: payment, integration:, integration_external_id: "1") }

      it "updates the integration record with the new sync_token" do
        expect do
          payment.create_or_update_quickbooks_integration_record!(integration:, parsed_body: { "Id" => "1", "SyncToken" => "1" })
        end.to change { IntegrationRecord.count }.by(0)
        .and change { integration.reload.last_sync_at }.from(nil).to(Time.current)

        expect(integration_record.reload.integration_external_id).to eq("1")
        expect(integration_record.sync_token).to eq("1")
      end
    end
  end

  describe "#serialize" do
    let(:company) { create(:company) }
    let!(:integration) { create(:quickbooks_integration, company:) }
    let(:contractor) { create(:company_worker, company:) }
    let(:invoice) { create(:invoice, company:, user: contractor.user) }
    let!(:invoice_integration_record) { create(:integration_record, integratable: invoice, integration:) }
    let(:payment) { create(:payment, invoice:) }

    context "when invoice has no paid_at date" do
      it "returns the serialized object with current date as TxnDate" do
        expect(payment.serialize(namespace: "Quickbooks")).to eq(
          {
            Line: [
              {
                Amount: 60.0,
                LinkedTxn: [
                  TxnId: invoice_integration_record.integration_external_id,
                  TxnType: "Bill",
                ],
              }
            ],
            TotalAmt: 60.0,
            TxnDate: Date.current.iso8601,
            PayType: "Check",
            CheckPayment: {
              BankAccountRef: {
                value: integration.flexile_clearance_bank_account_id,
              },
            },
            VendorRef: {
              value: contractor.integration_external_id,
            },
          }.to_json
        )
      end
    end

    context "when invoice has a paid_at date" do
      let(:paid_date) { Date.new(2025, 1, 15) }

      before do
        invoice.update!(paid_at: paid_date)
      end

      it "returns the serialized object with invoice's paid_at date as TxnDate" do
        expect(payment.serialize(namespace: "Quickbooks")).to eq(
          {
            Line: [
              {
                Amount: 60.0,
                LinkedTxn: [
                  TxnId: invoice_integration_record.integration_external_id,
                  TxnType: "Bill",
                ],
              }
            ],
            TotalAmt: 60.0,
            TxnDate: paid_date.iso8601,
            PayType: "Check",
            CheckPayment: {
              BankAccountRef: {
                value: integration.flexile_clearance_bank_account_id,
              },
            },
            VendorRef: {
              value: contractor.integration_external_id,
            },
          }.to_json
        )
      end
    end
  end
end
