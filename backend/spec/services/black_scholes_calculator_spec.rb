# frozen_string_literal: true

RSpec.describe BlackScholesCalculator do
  describe ".calculate_option_value" do
    it "calculates Black-Scholes option value correctly" do
      option_value = described_class.calculate_option_value(
        current_price: 100.0,
        exercise_price: 95.0,
        time_to_expiration_years: 1.0,
        risk_free_rate: 0.05,
        volatility: 0.20
      )

      expect(option_value).to be > 0
      expect(option_value).to be < 100.0
    end

    it "returns zero for expired options" do
      option_value = described_class.calculate_option_value(
        current_price: 100.0,
        exercise_price: 95.0,
        time_to_expiration_years: 0.0
      )

      expect(option_value).to eq(0.0)
    end

    it "returns zero for negative time to expiration" do
      option_value = described_class.calculate_option_value(
        current_price: 100.0,
        exercise_price: 95.0,
        time_to_expiration_years: -1.0
      )

      expect(option_value).to eq(0.0)
    end

    it "uses default parameters when not specified" do
      option_value = described_class.calculate_option_value(
        current_price: 100.0,
        exercise_price: 95.0,
        time_to_expiration_years: 1.0
      )

      expect(option_value).to be > 0
    end
  end
end
