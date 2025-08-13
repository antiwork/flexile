# frozen_string_literal: true

require "spec_helper"

RSpec.describe QuickbooksDataSyncJob, type: :job do
  describe "#perform" do
    let(:company) { create(:company) }
    let(:company_id) { company.id }
    let!(:integration) { create(:quickbooks_integration, company:) }
    let(:contractor) { create(:company_worker, company:) }

    before do
      allow(IntegrationApi::Quickbooks).to receive(:new).and_return(double(sync_data_for: true))
    end

    context "with CompanyContractor object type" do
      it "converts CompanyContractor to CompanyWorker and syncs" do
        integration_api = instance_double(IntegrationApi::Quickbooks)
        expect(IntegrationApi::Quickbooks).to receive(:new).with(company_id:).and_return(integration_api)
        expect(integration_api).to receive(:sync_data_for).with(object: contractor)

        described_class.new.perform(company_id, "CompanyContractor", contractor.id)
      end
    end

    context "with CompanyWorker object type" do
      it "syncs the contractor directly" do
        integration_api = instance_double(IntegrationApi::Quickbooks)
        expect(IntegrationApi::Quickbooks).to receive(:new).with(company_id:).and_return(integration_api)
        expect(integration_api).to receive(:sync_data_for).with(object: contractor)

        described_class.new.perform(company_id, "CompanyWorker", contractor.id)
      end
    end

    context "with Invoice object type" do
      let(:invoice) { create(:invoice, company:, user: contractor.user) }

      it "syncs the invoice" do
        integration_api = instance_double(IntegrationApi::Quickbooks)
        expect(IntegrationApi::Quickbooks).to receive(:new).with(company_id:).and_return(integration_api)
        expect(integration_api).to receive(:sync_data_for).with(object: invoice)

        described_class.new.perform(company_id, "Invoice", invoice.id)
      end
    end

    context "with Payment object type" do
      let(:invoice) { create(:invoice, company:, user: contractor.user) }
      let(:payment) { create(:payment, invoice:) }

      it "syncs the payment" do
        integration_api = instance_double(IntegrationApi::Quickbooks)
        expect(IntegrationApi::Quickbooks).to receive(:new).with(company_id:).and_return(integration_api)
        expect(integration_api).to receive(:sync_data_for).with(object: payment)

        described_class.new.perform(company_id, "Payment", payment.id)
      end
    end

    context "with ConsolidatedInvoice object type" do
      let(:invoice) { create(:invoice, company:, user: contractor.user) }
      let(:consolidated_invoice) { create(:consolidated_invoice, company:, invoices: [invoice]) }

      it "syncs the consolidated invoice" do
        integration_api = instance_double(IntegrationApi::Quickbooks)
        expect(IntegrationApi::Quickbooks).to receive(:new).with(company_id:).and_return(integration_api)
        expect(integration_api).to receive(:sync_data_for).with(object: consolidated_invoice)

        described_class.new.perform(company_id, "ConsolidatedInvoice", consolidated_invoice.id)
      end
    end

    context "with ConsolidatedPayment object type" do
      let(:invoice) { create(:invoice, company:, user: contractor.user) }
      let(:consolidated_invoice) { create(:consolidated_invoice, company:, invoices: [invoice]) }
      let(:consolidated_payment) { create(:consolidated_payment, consolidated_invoice:) }

      it "syncs the consolidated payment" do
        integration_api = instance_double(IntegrationApi::Quickbooks)
        expect(IntegrationApi::Quickbooks).to receive(:new).with(company_id:).and_return(integration_api)
        expect(integration_api).to receive(:sync_data_for).with(object: consolidated_payment)

        described_class.new.perform(company_id, "ConsolidatedPayment", consolidated_payment.id)
      end
    end

    context "when object does not exist" do
      it "raises ActiveRecord::RecordNotFound" do
        expect do
          described_class.new.perform(company_id, "CompanyWorker", 999999)
        end.to raise_error(ActiveRecord::RecordNotFound)
      end
    end

    context "when IntegrationApi::Quickbooks raises an error" do
      it "allows the error to bubble up for Sidekiq retry handling" do
        integration_api = instance_double(IntegrationApi::Quickbooks)
        expect(IntegrationApi::Quickbooks).to receive(:new).with(company_id:).and_return(integration_api)
        expect(integration_api).to receive(:sync_data_for).and_raise(StandardError, "QuickBooks API error")

        expect do
          described_class.new.perform(company_id, "CompanyWorker", contractor.id)
        end.to raise_error(StandardError, "QuickBooks API error")
      end
    end
  end
end
