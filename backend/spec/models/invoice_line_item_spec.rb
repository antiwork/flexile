# frozen_string_literal: true

RSpec.describe InvoiceLineItem do
  describe "associations" do
    it { is_expected.to belong_to(:invoice) }
    it { is_expected.to have_many(:integration_records) }
    it { is_expected.to have_one(:quickbooks_integration_record) }
  end

  describe "validations" do
    it { is_expected.to validate_presence_of(:description) }
    it { is_expected.to validate_presence_of(:pay_rate_in_subunits) }
    it { is_expected.to validate_numericality_of(:pay_rate_in_subunits).only_integer.is_greater_than(0) }
    it { is_expected.to validate_presence_of(:quantity) }
    it { is_expected.to validate_numericality_of(:quantity).is_greater_than_or_equal_to(0.01) }
  end

  describe "#cash_amount_in_cents" do
    let(:invoice) { create(:invoice, total_amount_in_usd_cents: 50_00, equity_percentage: 25) }
    let(:invoice_line_item) do
      build(:invoice_line_item, invoice:, quantity: 30, hourly: true, pay_rate_in_subunits: 100_00)
    end

    context "when the invoice has an equity percentage" do
      it "returns the cash amount in cents" do
        expect(invoice_line_item.cash_amount_in_cents).to eq(37_50)
      end
    end

    context "when the invoice does not have an equity percentage" do
      let(:invoice) { create(:invoice, total_amount_in_usd_cents: 50_00, equity_percentage: 0) }

      it "returns the total amount in cents" do
        expect(invoice_line_item.cash_amount_in_cents).to eq(50_00)
      end
    end
  end

  describe "#cash_amount_in_usd" do
    let(:invoice) { create(:invoice, total_amount_in_usd_cents: 50_00, equity_percentage: 25) }
    let(:invoice_line_item) do
      build(:invoice_line_item, invoice:, quantity: 30, hourly: true, pay_rate_in_subunits: 100_00)
    end

    context "when the invoice has an equity percentage" do
      it "returns the cash amount in USD" do
        expect(invoice_line_item.cash_amount_in_usd).to eq(37.5)
      end
    end

    context "when the invoice does not have an equity percentage" do
      let(:invoice) { create(:invoice, total_amount_in_usd_cents: 50_00, equity_percentage: 0) }

      it "returns the total amount in USD" do
        expect(invoice_line_item.cash_amount_in_usd).to eq(50.0)
      end
    end
  end
end
