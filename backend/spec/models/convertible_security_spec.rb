# frozen_string_literal: true

RSpec.describe ConvertibleSecurity do
  describe "associations" do
    it { is_expected.to belong_to(:company_investor) }
    it { is_expected.to belong_to(:convertible_investment) }
  end

  describe "validations" do
    it { is_expected.to validate_presence_of(:issued_at) }
    it { is_expected.to validate_presence_of(:principal_value_in_cents) }
    it { is_expected.to validate_numericality_of(:principal_value_in_cents).is_greater_than_or_equal_to(0).only_integer }
    it { is_expected.to validate_presence_of(:implied_shares) }
    it { is_expected.to validate_numericality_of(:implied_shares).is_greater_than(0.0) }
    it { is_expected.to validate_numericality_of(:valuation_cap_cents).is_greater_than(0).only_integer }
    it { is_expected.to validate_numericality_of(:discount_rate_percent).is_greater_than_or_equal_to(0).is_less_than_or_equal_to(100) }
    it { is_expected.to validate_numericality_of(:interest_rate_percent).is_greater_than_or_equal_to(0) }
    it { is_expected.to validate_numericality_of(:seniority_rank).is_greater_than_or_equal_to(0).only_integer }

    describe "valuation_cap_cents" do
      it "allows nil values" do
        security = build(:convertible_security, valuation_cap_cents: nil)
        expect(security).to be_valid
      end
    end

    describe "discount_rate_percent" do
      it "allows nil values" do
        security = build(:convertible_security, discount_rate_percent: nil)
        expect(security).to be_valid
      end
    end

    describe "interest_rate_percent" do
      it "allows nil values" do
        security = build(:convertible_security, interest_rate_percent: nil)
        expect(security).to be_valid
      end
    end

    describe "seniority_rank" do
      it "allows nil values" do
        security = build(:convertible_security, seniority_rank: nil)
        expect(security).to be_valid
      end
    end
  end
end
