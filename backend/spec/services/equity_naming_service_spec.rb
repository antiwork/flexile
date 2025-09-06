# frozen_string_literal: true

RSpec.describe EquityNamingService do
  describe ".next_name" do
    let(:company) { create(:company, name: "Gummy Bears Inc") }

    context "when collection is empty" do
      it "returns PREFIX-1 with given prefix length" do
        result = described_class.next_name(company: company, collection: company.equity_grants, prefix_length: 3)
        expect(result).to eq("GUM-1")
      end
    end

    context "when collection has existing named records" do
      it "increments trailing number while preserving existing prefix" do
        investor = create(:company_investor, company: company)
        create(:equity_grant, company_investor: investor, name: "GUMMY-7")

        next_name = described_class.next_name(company: company, collection: company.equity_grants, prefix_length: 3)
        expect(next_name).to eq("GUMMY-8")
      end
    end

    it "respects different prefix lengths" do
      result1 = described_class.next_name(company: company, collection: company.equity_grants, prefix_length: 1)
      result2 = described_class.next_name(company: company, collection: company.equity_grants, prefix_length: 4)

      expect(result1).to eq("G-1")
      expect(result2).to eq("GUMM-1")
    end
  end

  describe ".option_holder_name" do
    let(:individual) do
      user = create(:user, without_compliance_info: true, legal_name: "John Smith")
      create(:user_compliance_info, user:, business_entity: false)
      user
    end

    let(:us_company) do
      user = create(:user, without_compliance_info: true, legal_name: "Acme LLC", country_code: "US")
      create(:user_compliance_info, user:, business_entity: true, business_name: "Acme Holdings")
      user
    end

    let(:in_company) do
      user = create(:user, without_compliance_info: true, legal_name: "Acme India Pvt Ltd", country_code: "IN")
      create(:user_compliance_info, user:, business_entity: true, business_name: "Acme India")
      user
    end

    it "returns legal name for individuals" do
      expect(described_class.option_holder_name(individual)).to eq("John Smith")
    end

    it "returns business name for non-IN business entities" do
      expect(described_class.option_holder_name(us_company)).to eq("Acme Holdings")
    end

    it "returns legal name for IN business entities" do
      expect(described_class.option_holder_name(in_company)).to eq("Acme India Pvt Ltd")
    end
  end
end
