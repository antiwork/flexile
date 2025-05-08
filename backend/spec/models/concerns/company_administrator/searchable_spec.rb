# frozen_string_literal: true

RSpec.describe CompanyAdministrator::Searchable do
  describe "#records_for_search" do
    let(:company) { create(:company) }
    let(:company_invoices) { create_list(:invoice, 2, company:) }

    let(:company_administrator) { create(:company_administrator, company:) }
    let(:company_worker) { create(:company_worker, company:) }
    let!(:invoices) { create_list(:invoice, 2, company:) }
    let!(:company_investors) { create_list(:company_investor, 3, company:) }

    it "returns the records for search" do
      expect(company_administrator.reload.records_for_search).to eq(
        invoices:,
        company_investors:,
        company_workers: [company_worker],
      )
    end
  end
end
