# frozen_string_literal: true

RSpec.describe InvoiceLineItem do
  describe "associations" do
    it { is_expected.to belong_to(:invoice) }
    it { is_expected.to have_many(:integration_records) }
    it { is_expected.to have_one(:quickbooks_integration_record) }
  end

  describe "delegations" do
    it { is_expected.to delegate_method(:for_hourly_services?).to(:invoice) }
    it { is_expected.to delegate_method(:invoice_type_services?).to(:invoice) }
  end

  describe "validations" do
    it { is_expected.to validate_presence_of(:description) }
    it { is_expected.to validate_presence_of(:total_amount_cents) }
    it { is_expected.to validate_numericality_of(:total_amount_cents).only_integer.is_greater_than(0) }

    describe "pay_rate_in_subunits" do
      let(:invoice_line_item) { build(:invoice_line_item) }

      context "for a services invoice type" do
        before { allow(invoice_line_item).to receive(:invoice_type_services?).and_return(true) }

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

      context "for a non-services invoice type" do
        before { allow(invoice_line_item).to receive(:invoice_type_services?).and_return(false) }

        it "does not validate pay_rate_in_subunits" do
          invoice_line_item.pay_rate_in_subunits = nil
          expect(invoice_line_item).to be_valid
        end
      end
    end

    describe "total_minutes" do
      context "for hourly contractor invoices" do
        it "ensures that minutes is present for a services invoice type" do
          invoice = build(:invoice, total_minutes: nil)
          invoice_line_item = invoice.invoice_line_items.first
          expect(invoice_line_item).to be_invalid
          expect(invoice_line_item.errors.full_messages).to eq(["Minutes can't be blank", "Minutes is not a number"])

          invoice_line_item.minutes = 0
          expect(invoice_line_item).to be_invalid
          expect(invoice_line_item.errors.full_messages).to eq(["Minutes must be greater than 0"])

          invoice_line_item.minutes = 60
          expect(invoice_line_item).to be_valid
        end

        it "does not validate minutes for a non-services invoice type" do
          invoice = build(:invoice, invoice_type: "other")
          invoice_line_item = build(:invoice_line_item, invoice:, minutes: nil)
          invoice.invoice_line_items << invoice_line_item
          expect(invoice_line_item).to be_valid
        end
      end

      it "does not validate minutes for project-based contractor invoice line items" do
        invoice = build(:invoice, :project_based)
        invoice_line_item = build(:invoice_line_item, invoice:, minutes: nil)
        invoice.invoice_line_items << invoice_line_item
        expect(invoice_line_item).to be_valid

        invoice_line_item.minutes = 0
        expect(invoice_line_item).to be_valid
      end
    end
  end

  describe "#cash_amount_in_cents" do
    let(:invoice) { create(:invoice, total_amount_in_usd_cents: 50_00, equity_percentage: 25) }
    let(:invoice_line_item) do
      build(:invoice_line_item, invoice:, minutes: 30, pay_rate_in_subunits: 100_00, total_amount_cents: 50_00)
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
      build(:invoice_line_item, invoice:, minutes: 30, pay_rate_in_subunits: 100_00, total_amount_cents: 50_00)
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
