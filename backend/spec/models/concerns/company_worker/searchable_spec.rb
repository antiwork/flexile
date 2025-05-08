# frozen_string_literal: true

RSpec.describe CompanyWorker::Searchable do
  describe "#records_for_search" do
    let(:company) { create(:company) }
    let(:company_invoices) { create_list(:invoice, 2, company:) }

    let(:invoices) { create_list(:invoice, 2, company:, user: company_worker.user) }
    let!(:company_worker) { create(:company_worker, company:) }
    let!(:company_investor) { create(:company_investor, company:) }

    let(:company_workers) { CompanyWorker.none }
    let(:company_investors) { CompanyInvestor.none }

    it "returns the records for search" do
      expect(company_worker.reload.records_for_search).to eq({ invoices:, company_workers:, company_investors: })
    end
  end
end
