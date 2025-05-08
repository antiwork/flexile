# frozen_string_literal: true

RSpec.describe Wise::AccountBalance do
  let(:current_balance_cents) { 1_5002_78 }

  before do
    create(:wise_credential)

    $redis.mset(
      Wise::AccountBalance::AMOUNT_KEY, 1_000_00,
      Wise::AccountBalance::UPDATED_AT_KEY, 1.day.ago.to_i,
    )

    api_response = [
      {
        "is" => 97347,
        "currency" => "USD",
        "amount" => {
          "value" => current_balance_cents / 100.0,
          "currency" => "USD",
        },
      },
    ]
    allow_any_instance_of(Wise::PayoutApi).to receive(:get_balances).and_return(api_response)
  end

  describe ".refresh_flexile_balance" do
    it "updates Flexile's Wise account balance in Redis and returns the balance" do
      result = described_class.refresh_flexile_balance

      expect(result).to eq(current_balance_cents / 100.0)
      expect($redis.get(Wise::AccountBalance::AMOUNT_KEY)).to eq(current_balance_cents.to_s)
    end
  end

  describe ".flexile_balance_usd" do
    it "returns Flexile's Wise account balance in USD" do
      $redis.set(Wise::AccountBalance::AMOUNT_KEY, 12_345_67)

      expect(described_class.flexile_balance_usd).to eq(12_345.67)
    end
  end

  describe ".has_sufficient_flexile_balance?" do
    it "refreshes the Flexile balance" do
      expect do
        described_class.has_sufficient_flexile_balance?(100)
      end.to change { $redis.get(Wise::AccountBalance::AMOUNT_KEY) }.from("100000").to(current_balance_cents.to_s)
    end

    it "returns true if Flexile's balance is greater than or equal to the amount provided plus buffer" do
      result = described_class.has_sufficient_flexile_balance?(current_balance_cents / 100.0 - Balance::REQUIRED_BALANCE_BUFFER_IN_USD)
      expect(result).to eq(true)
    end

    it "returns false if Flexile's balance is less than the amount provided plus buffer" do
      result = described_class.has_sufficient_flexile_balance?(current_balance_cents / 100.0 - Balance::REQUIRED_BALANCE_BUFFER_IN_USD + 0.01)
      expect(result).to eq(false)
    end
  end

  describe ".simulate_top_up_usd_balance", :vcr do
    it "simulates a top-up of the balance" do
      result = described_class.simulate_top_up_usd_balance(amount: 1_000)
      expect(result["state"]).to eq("COMPLETED")
    end
  end
end
