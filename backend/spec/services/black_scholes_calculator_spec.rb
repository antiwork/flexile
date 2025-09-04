# frozen_string_literal: true

RSpec.describe BlackScholesCalculator do
  describe ".calculate_option_value" do
    it "calculates Black-Scholes option value correctly" do
      option_value = described_class.calculate_option_value(
        current_price: 100.0,
        exercise_price: 95.0,
        expiration_date: Date.current + 365
      )

      expect(option_value).to be_within(0.5).of(30.58)
    end

    it "returns zero for expired options" do
      option_value = described_class.calculate_option_value(
        current_price: 100.0,
        exercise_price: 95.0,
        expiration_date: Date.current
      )

      expect(option_value).to eq(0.0)
    end

    it "returns zero for negative time to expiration" do
      option_value = described_class.calculate_option_value(
        current_price: 100.0,
        exercise_price: 95.0,
        expiration_date: Date.current - 365
      )

      expect(option_value).to eq(0.0)
    end

    it "uses default parameters when not specified" do
      option_value = described_class.calculate_option_value(
        current_price: 100.0,
        exercise_price: 95.0,
        expiration_date: Date.current + 365
      )

      expect(option_value).to be_within(0.5).of(30.58)
    end
  end
end
