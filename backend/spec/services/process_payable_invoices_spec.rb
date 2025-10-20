# frozen_string_literal: true

RSpec.describe ProcessPayableInvoices do
  let(:company) { create(:company) }
  let!(:stripe_account) { create(:company_stripe_account, company:) }
  let(:worker) { create(:company_worker, company:) }

  describe "#perform" do
    context "when invoices are eligible for consolidated charging" do
      let!(:invoice) { create(:invoice, :fully_approved, company:, company_worker: worker, user: worker.user, created_by: worker.user) }
      let(:service) { described_class.new(company:) }

      it "creates a consolidated invoice and enqueues a charge" do
        expect do
          service.perform
        end.to change { company.consolidated_invoices.count }.by(1)

        new_consolidated = company.consolidated_invoices.order(:created_at).last
        expect(new_consolidated.invoices).to include(invoice)
        expect(ChargeConsolidatedInvoiceJob).to have_enqueued_sidekiq_job(new_consolidated.id)
      end
    end

    context "when scoped to a specific user" do
      let(:other_worker) { create(:company_worker, company:) }
      let!(:target_invoice) { create(:invoice, :fully_approved, company:, company_worker: worker, user: worker.user, created_by: worker.user) }
      let!(:other_invoice) { create(:invoice, :fully_approved, company:, company_worker: other_worker, user: other_worker.user, created_by: other_worker.user) }
      let(:service) { described_class.new(company:, user: worker.user) }

      it "only consolidates invoices for that user" do
        service.perform

        new_consolidated = company.consolidated_invoices.order(:created_at).last
        expect(new_consolidated.invoices).to contain_exactly(target_invoice)
      end
    end

    context "when the company bank account is not ready" do
      let(:service) { described_class.new(company:) }

      before { stripe_account.update!(status: CompanyStripeAccount::INITIAL) }

      it "does not attempt to process invoices" do
        expect(ConsolidatedInvoiceCreation).not_to receive(:new)

        service.perform
      end
    end
  end
end
