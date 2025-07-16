# frozen_string_literal: true

RSpec.describe LiquidationPayout do
  describe "associations" do
    it { is_expected.to belong_to(:liquidation_scenario) }
    it { is_expected.to belong_to(:company_investor) }
  end

  describe "validations" do
    it { is_expected.to validate_presence_of(:security_type) }
    it { is_expected.to validate_presence_of(:payout_amount_cents) }
    it { is_expected.to validate_inclusion_of(:security_type).in_array(%w[equity convertible]) }
    it { is_expected.to validate_numericality_of(:payout_amount_cents).is_greater_than_or_equal_to(0).only_integer }
    it { is_expected.to validate_numericality_of(:number_of_shares).is_greater_than(0).only_integer }

    describe "number_of_shares" do
      it "allows nil values" do
        payout = build(:liquidation_payout, number_of_shares: nil)
        expect(payout).to be_valid
      end

      it "validates positive integer when present" do
        payout = build(:liquidation_payout, number_of_shares: -1)
        expect(payout).to be_invalid
        expect(payout.errors[:number_of_shares]).to include("must be greater than 0")
      end
    end
  end
end