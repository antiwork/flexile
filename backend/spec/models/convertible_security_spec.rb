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
  end
end
