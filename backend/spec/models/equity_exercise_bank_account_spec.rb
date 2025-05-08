# frozen_string_literal: true

RSpec.describe EquityExerciseBankAccount do
  describe "associations" do
    it { is_expected.to belong_to(:company) }
  end

  describe "validations" do
    it { is_expected.to validate_presence_of(:details) }
    it { is_expected.to validate_presence_of(:account_number) }
  end

  describe "#all_details" do
    let(:equity_exercise_bank_account) { build(:equity_exercise_bank_account) }

    it "returns all details" do
      expect(equity_exercise_bank_account.all_details).to eq(
        {
          "Account number" => "0123456789",
          "Beneficiary name" => equity_exercise_bank_account.company.name,
          "Beneficiary address" => "548 Market Street, San Francisco, CA 94104",
          "Bank name" => "Mercury Business",
          "Routing number" => "987654321",
          "SWIFT/BIC" => "WZYOPW1L",
        }
      )
    end
  end
end
