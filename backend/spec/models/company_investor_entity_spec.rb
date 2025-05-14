# frozen_string_literal: true

RSpec.describe CompanyInvestorEntity do
  describe "associations" do
    it { is_expected.to belong_to(:company) }
  end

  describe "validations" do
    it { is_expected.to validate_presence_of(:name) }
    it { is_expected.to validate_presence_of(:email) }
    it { is_expected.to validate_presence_of(:investment_amount_cents) }
    it { is_expected.to validate_numericality_of(:investment_amount_cents).is_greater_than_or_equal_to(0).only_integer }
    it { is_expected.to validate_presence_of(:total_shares) }
    it { is_expected.to validate_numericality_of(:total_shares).is_greater_than_or_equal_to(0).only_integer }
    it { is_expected.to validate_presence_of(:total_options) }
    it { is_expected.to validate_numericality_of(:total_options).is_greater_than_or_equal_to(0).only_integer }

    context "when another record exists" do
      before { create(:company_investor_entity) }

      it { is_expected.to validate_uniqueness_of(:email).scoped_to(:company_id, :name) }
    end
  end

  describe "scopes" do
    describe ".with_shares_or_options" do
      before do
        @company_investor_entity_with_shares = create(:company_investor_entity, total_shares: 1)
        @company_investor_entity_with_options = create(:company_investor_entity, total_options: 100)
        create(:company_investor_entity, total_shares: 0, total_options: 0)
      end

      it "returns only company investors with shares or options" do
        expect(described_class.with_shares_or_options).to match_array([
                                                                        @company_investor_entity_with_options,
                                                                        @company_investor_entity_with_shares
                                                                      ])
      end
    end
  end
end
