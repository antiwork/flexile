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

  describe "#user_info" do
    it "returns information as expected" do
      result = described_class.new(email: user.email).user_info

      expect(result.keys).to match_array(%i[prompt metadata])
      expect(result[:metadata]).to eq({ name: user.email })

      expected_prompt = [
        "The user's residence country is #{user.display_country}",
        "The user is a contractor for Gumroad",
        "The user is an investor for Acme and Gumroad",
        "The user is an administrator for Glamazon",
        "The user invested $5,623.00 in Acme",
        "The user invested $234.00 in Gumroad",
        "The user received a dividend of $123.45 from Acme. The status of the dividend is Issued.",
        "The user received a dividend of $23.31 from Gumroad. The status of the dividend is Paid.",
        "The user's minimum dividend payment is $100.00",
        "The user has an invoice to Gumroad (##{invoice.invoice_number}) with status approved. Total: $500.00, Cash: $300.00, Equity: $200.00, Date: #{Date.current}."
      ].join("\n")

      expect(result[:prompt]).to eq(expected_prompt)
    end
  end
end
