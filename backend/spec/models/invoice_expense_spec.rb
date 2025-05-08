# frozen_string_literal: true

RSpec.describe InvoiceExpense do
  describe "associations" do
    it { is_expected.to belong_to(:invoice) }
    it { is_expected.to belong_to(:expense_category) }
    it { is_expected.to have_one_attached(:attachment) }
  end

  describe "validations" do
    it { is_expected.to validate_presence_of(:description) }
    it { is_expected.to validate_presence_of(:invoice) }
    it { is_expected.to validate_presence_of(:expense_category) }
    it { is_expected.to validate_presence_of(:attachment) }
    it { is_expected.to validate_presence_of(:total_amount_in_cents) }
  end

  describe "delegations" do
    it { is_expected.to delegate_method(:expense_account_id).to(:expense_category) }
  end

  describe "#cash_amount_in_cents" do
    it "is an alias for total_amount_in_cents attribute" do
      invoice_expense = build_stubbed(:invoice_expense, total_amount_in_cents: 12_34)
      expect(invoice_expense.cash_amount_in_cents).to eq(invoice_expense.total_amount_in_cents)
    end
  end

  describe "#total_amount_in_usd" do
    it "returns the total amount in USD" do
      invoice_expense = build_stubbed(:invoice_expense, total_amount_in_cents: 12_34)
      expect(invoice_expense.total_amount_in_usd).to eq(12.34)
    end
  end

  describe "#cash_amount_in_usd" do
    it "returns the total amount in USD" do
      invoice_expense = build_stubbed(:invoice_expense, total_amount_in_cents: 12_34)
      expect(invoice_expense.cash_amount_in_usd).to eq(12.34)
    end
  end
end
