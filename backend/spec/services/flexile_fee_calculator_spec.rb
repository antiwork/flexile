# frozen_string_literal: true

RSpec.describe FlexileFeeCalculator do
  describe ".calculate_invoice_fee_cents" do
    it "calculates base fee for zero amount" do
      expect(described_class.calculate_invoice_fee_cents(0)).to eq 50
    end

    it "calculates fee for small amount" do
      expect(described_class.calculate_invoice_fee_cents(100_00)).to eq 50 + (0.015 * 100_00)
    end

    it "caps fee at maximum for large amount" do
      expect(described_class.calculate_invoice_fee_cents(10_000_00)).to eq 15_00
    end

    it "rounds fee correctly" do
      expect(described_class.calculate_invoice_fee_cents(100_01)).to eq 200
    end
  end

  describe ".calculate_dividend_fee_cents" do
    it "calculates base fee for zero amount" do
      expect(described_class.calculate_dividend_fee_cents(0)).to eq 30
    end

    it "calculates fee for small amount" do
      expect(described_class.calculate_dividend_fee_cents(100_00)).to eq 30 + (0.029 * 100_00)
    end

    it "caps fee at maximum for large amount" do
      expect(described_class.calculate_dividend_fee_cents(10_000_00)).to eq 30_00
    end

    it "rounds fee correctly" do
      expect(described_class.calculate_dividend_fee_cents(100_01)).to eq 320
    end
  end
end
