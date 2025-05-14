# frozen_string_literal: true

RSpec.describe CompanyLawyer::Searchable do
  describe "#records_for_search" do
    let(:company) { create(:company) }
    let!(:company_invoices) { create_list(:invoice, 2, company:) }
    let!(:company_worker) { create(:company_worker, company:) }
    let!(:company_lawyer) { create(:company_lawyer, company:) }

    it "returns empty list of records for search" do
      expect(company_lawyer.reload.records_for_search).to eq(
        invoices: [],
        company_workers: [],
        company_investors: [],
      )
    end
  end
end
