# frozen_string_literal: true

RSpec.describe HelperUserInfoService do
  let(:user) { create(:user, minimum_dividend_payment_in_cents: 100_00) }
  let(:gumroad) { create(:company, public_name: "Gumroad") }
  let!(:company_worker) { create(:company_worker, user:, company: gumroad) }
  let!(:invoice) { create(:invoice, user:, company: gumroad, company_worker: company_worker, status: "approved", total_amount_in_usd_cents: 50000, cash_amount_in_cents: 30000, equity_amount_in_cents: 20000) }

  before do
    acme = create(:company, public_name: "Acme")
    acme_company_investor = create(:company_investor, user:, company: acme, investment_amount_in_cents: 5_623_00)
    create(:dividend, company_investor: acme_company_investor, total_amount_in_cents: 123_45)

    gumroad_company_investor = create(:company_investor, user:, company: gumroad, investment_amount_in_cents: 234_00)
    create(:dividend, :paid, company_investor: gumroad_company_investor, total_amount_in_cents: 23_31)

    glamazon = create(:company, public_name: "Glamazon")
    create(:company_administrator, user:, company: glamazon)
  end

  describe "#customer_info" do
    it "returns an empty hash if the user is not found" do
      result = described_class.new(email: "nonexistent@example.com").customer_info
      expect(result).to eq({})
    end

    it "returns information as expected" do
      result = described_class.new(email: user.email).customer_info

      expect(result).to eq(
        name: user.email,
        metadata: {
          "Country of residence" => user.display_country,
          "Contractor for companies" => "Gumroad",
          "Investor for companies" => "Acme and Gumroad",
          "Administrator for companies" => "Glamazon",
          "Investments" => [
            {
              "Company" => "Acme",
              "Amount" => "$5,623.00",
            },
            {
              "Company" => "Gumroad",
              "Amount" => "$234.00",
            }
          ],
          "Dividends received" => [
            { "Company" => "Acme", "Amount" => "$123.45", "Status" => "Issued" },
            { "Company" => "Gumroad", "Amount" => "$23.31", "Status" => "Paid" }
          ],
          "Minimum dividend payment" => 100_00,
          "Invoices submitted" => [
            {
              "Company" => "Gumroad",
              "Invoice number" => invoice.invoice_number,
              "Status" => "approved",
              "Total" => "$500.00",
              "Cash" => "$300.00",
              "Equity" => "$200.00",
              "Date" => invoice.invoice_date.to_s,
            }
          ],
        }
      )
    end
  end
end
