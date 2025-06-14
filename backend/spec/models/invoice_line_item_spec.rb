# frozen_string_literal: true

RSpec.describe InvoiceLineItem do
  describe "associations" do
    it { is_expected.to belong_to(:invoice) }
    it { is_expected.to have_many(:integration_records) }
    it { is_expected.to have_one(:quickbooks_integration_record) }
  end

  describe "validations" do
    it { is_expected.to validate_presence_of(:description) }

    describe "pay_rate_in_subunits" do
      let(:invoice_line_item) { build(:invoice_line_item) }

      it "requires pay_rate_in_subunits to be present" do
        invoice_line_item.pay_rate_in_subunits = nil
        expect(invoice_line_item).to be_invalid
        expect(invoice_line_item.errors[:pay_rate_in_subunits]).to include("can't be blank")
      end

      it "requires pay_rate_in_subunits to be greater than 0" do
        invoice_line_item.pay_rate_in_subunits = 0
        expect(invoice_line_item).to be_invalid
        expect(invoice_line_item.errors[:pay_rate_in_subunits]).to include("must be greater than 0")
      end

      it "requires pay_rate_in_subunits to be an integer" do
        invoice_line_item.pay_rate_in_subunits = 1.5
        expect(invoice_line_item).to be_invalid
        expect(invoice_line_item.errors[:pay_rate_in_subunits]).to include("must be an integer")
      end
    end
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
