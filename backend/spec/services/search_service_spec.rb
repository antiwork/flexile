# frozen_string_literal: true

RSpec.describe SearchService do
  let!(:company_administrator) { create(:company_administrator) }
  let(:company) { company_administrator.company }
  let(:company2) { create(:company) }
  let(:john) { create(:user, legal_name: "John Parker", preferred_name: "Johny") }
  let(:sam) do
    create(:user, :without_compliance_info, legal_name: "Sam Clint", preferred_name: "Samy").tap do |user|
      create(:user_compliance_info, user:, business_name: "Dream Ventures")
    end
  end
  let(:alex) { create(:user, legal_name: "Alex Johnson", preferred_name: "Alex") }
  let!(:john_company_worker) { create :company_worker, company:, user: john }
  let!(:sam_company_worker) { create :company_worker, company:, user: sam }
  let!(:alex_company_investor) { create :company_investor, company:, user: alex }
  let!(:sam_invoices) do
    build_list(:invoice, 10, company_worker: sam_company_worker, user: sam) do |invoice, index|
      invoice.invoice_date = Date.new(2021, (index + 1), 1)
      invoice.save!
    end
  end
  let!(:john_invoices) do
    build_list(:invoice, 10, company_worker: john_company_worker, user: john) do |invoice, index|
      invoice.invoice_date = Date.new(2021, (index + 1), 2)
      invoice.save!
    end
  end
  let(:invoices) { company.invoices }
  let(:company_workers) { company.company_workers }
  let(:company_investors) { company.company_investors }
  let(:records_for_search) { { invoices:, company_workers:, company_investors: } }

  describe "#search" do
    shared_examples_for "invoices and contractors search" do |attribute, query|
      it "searches using #{attribute}" do
        search_result = described_class.new(company:,
                                            records_for_search:,
                                            query:).search

        expect(search_result[:invoices]).to eq sam.invoices.order(invoice_date: :desc).limit(6)
        expect(search_result[:company_workers]).to eq [sam_company_worker]
        expect(search_result[:company_investors]).to be_empty
      end
    end

    include_examples "invoices and contractors search", "first name", "sam"
    include_examples "invoices and contractors search", "last name", "clint"
    include_examples "invoices and contractors search", "business name", "dream"
    include_examples "invoices and contractors search", "preferred name", "samy"
    include_examples "invoices and contractors search", "fuzzy query strings", "sa cli"

    it "searches for invoice using invoice number" do
      invoice = sam_invoices.last
      invoice.update_attribute(:invoice_number, SecureRandom.hex)
      search_result = described_class.new(company:,
                                          records_for_search:,
                                          query: invoice.invoice_number).search

      expect(search_result[:invoices]).to eq [invoice]
      expect(search_result[:company_workers]).to be_empty
      expect(search_result[:company_investors]).to be_empty
    end

    it "searches for invoice using invoice month" do
      invoice_month = Date::MONTHNAMES[sam_invoices.last.invoice_date.month]
      search_result = described_class.new(company:,
                                          records_for_search:,
                                          query: invoice_month).search

      expect(search_result[:invoices]).to eq [john_invoices.last, sam_invoices.last]
      expect(search_result[:company_workers]).to be_empty
      expect(search_result[:company_investors]).to be_empty
    end

    it "searches for invoice using amount" do
      invoice = create(:invoice, company:, user: john, total_amount_in_usd_cents: 123456)
      search_result = described_class.new(company:,
                                          records_for_search:,
                                          query: "1234.56").search

      expect(search_result[:invoices]).to eq [invoice]
      expect(search_result[:company_workers]).to be_empty
      expect(search_result[:company_investors]).to be_empty
    end

    it "searches for invoice using Wise Transfer ID" do
      invoice = john_invoices.last
      wise_transfer_id = "wise_123"
      create(:payment, invoice:, wise_transfer_id:)
      search_result = described_class.new(company:,
                                          records_for_search:,
                                          query: wise_transfer_id).search

      expect(search_result[:invoices]).to eq [invoice]
      expect(search_result[:company_workers]).to be_empty
      expect(search_result[:company_investors]).to be_empty
    end

    it "searches for investors" do
      search_result = described_class.new(company:,
                                          records_for_search:,
                                          query: "alex").search

      expect(search_result[:invoices]).to be_empty
      expect(search_result[:company_workers]).to be_empty
      expect(search_result[:company_investors]).to eq [alex_company_investor]
    end

    it "doesn't return search results from another company" do
      search_result = described_class.new(company: company2,
                                          records_for_search:,
                                          query: sam.legal_name).search

      expect(search_result[:invoices]).to be_empty
      expect(search_result[:company_workers]).to be_empty
      expect(search_result[:company_investors]).to be_empty
    end
  end
end
