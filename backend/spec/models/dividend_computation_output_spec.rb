# frozen_string_literal: true

RSpec.describe DividendComputationOutput do
  describe "associations" do
    it { is_expected.to belong_to(:dividend_computation) }
    it { is_expected.to belong_to(:company_investor).optional(true) }
  end

  describe "validations" do
    it { is_expected.to validate_presence_of(:share_class) }
    it { is_expected.to validate_presence_of(:number_of_shares) }
    it { is_expected.to validate_presence_of(:preferred_dividend_amount_in_usd) }
    it { is_expected.to validate_presence_of(:dividend_amount_in_usd) }
    it { is_expected.to validate_presence_of(:total_amount_in_usd) }
    it { is_expected.to validate_numericality_of(:qualified_dividend_amount_usd).is_greater_than_or_equal_to(0) }

    it "validates that exactly one of company_investor_id or investor_name is present" do
      record = build(:dividend_computation_output, company_investor_id: 1, investor_name: "Test")
      expect(record.valid?).to eq(false)
      expect(record.errors[:base]).to include("Exactly one of company_investor_id or investor_name must be present")

      record = build(:dividend_computation_output, company_investor_id: 1, investor_name: nil)
      expect(record.valid?).to eq(true)

      record = build(:dividend_computation_output, company_investor: nil, investor_name: nil)
      expect(record.valid?).to eq(false)
      expect(record.errors[:base]).to include("Exactly one of company_investor_id or investor_name must be present")

      record = build(:dividend_computation_output, company_investor: nil, investor_name: "Test")
      expect(record.valid?).to eq(true)
    end
  end
end
