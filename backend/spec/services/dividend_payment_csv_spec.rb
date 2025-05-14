# frozen_string_literal: true

RSpec.describe DividendPaymentCsv do
  describe "#generate" do
    it "includes data for successful dividend payments" do
      company_investor = create(:company_investor, user: create(:user, legal_name: "Jane Q Investor", email: "jane@example.com"))
      dividend_1 = create(:dividend, company_investor:,
                                     paid_at: Date.parse("2023-12-28"),
                                     number_of_shares: 24,
                                     total_amount_in_cents: 125_25,
                                     net_amount_in_cents: 115_00,
                                     withholding_percentage: 5,
                                     withheld_tax_cents: 2_00,
                                     status: Dividend::PAID)
      create(:dividend_payment, dividends: [dividend_1], status: Payments::Status::FAILED)
      payment_1 = create(:dividend_payment, dividends: [dividend_1],
                                            transfer_id: "cde456",
                                            status: Payments::Status::SUCCEEDED,
                                            total_transaction_cents: 119_00,
                                            transfer_fee_in_cents: 6_00)

      company_investor = create(:company_investor, user: create(:user, legal_name: "John M Gumroad", email: "john@example.com"))
      dividend_2 = create(:dividend, company_investor:,
                                     paid_at: Date.parse("2023-12-24"),
                                     number_of_shares: 60,
                                     total_amount_in_cents: 250_00,
                                     net_amount_in_cents: 240_00,
                                     withholding_percentage: 0,
                                     withheld_tax_cents: 0,
                                     status: Dividend::PAID)
      payment_2 = create(:dividend_payment, dividends: [dividend_2],
                                            transfer_id: "xyz789",
                                            status: Payments::Status::SUCCEEDED,
                                            total_transaction_cents: 246_00,
                                            transfer_fee_in_cents: 4_00)

      dividend_3 = create(:dividend, company_investor:, status: Dividend::PROCESSING)
      create(:dividend_payment, dividends: [dividend_3], status: Payments::Status::FAILED)

      company_investor = create(:company_investor, user: create(:user, legal_name: "Cat Woman", email: "catwoman@example.com"))
      dividend_4 = create(:dividend, company_investor:,
                                     paid_at: Date.parse("2023-12-24"),
                                     total_amount_in_cents: 250_00,
                                     net_amount_in_cents: 240_00,
                                     number_of_shares: 100,
                                     withholding_percentage: 15,
                                     withheld_tax_cents: 10_00,
                                     status: Dividend::PAID)
      dividend_5 = create(:dividend, company_investor:,
                                     paid_at: Date.parse("2023-12-24"),
                                     total_amount_in_cents: 250_00,
                                     number_of_shares: 100,
                                     net_amount_in_cents: 240_00,
                                     withholding_percentage: 16,
                                     withheld_tax_cents: 10_00,
                                     status: Dividend::PAID)
      create(:dividend_payment, dividends: [dividend_4, dividend_5], status: Payments::Status::FAILED)
      payment_3 = create(:dividend_payment, dividends: [dividend_4, dividend_5],
                                            transfer_id: "fgnfgn67",
                                            status: Payments::Status::SUCCEEDED,
                                            total_transaction_cents: 246_00,
                                            transfer_fee_in_cents: 4_00)


      dividends = Dividend.where(id: [dividend_1, dividend_2, dividend_3, dividend_4, dividend_5].map(&:id))

      csv = described_class.new(dividends).generate
      parsed_csv = CSV.parse(csv)
      expect(parsed_csv).to match_array [
        DividendPaymentCsv::HEADERS,
        [dividend_1.company.name, dividend_1.id.to_s, "Jane Q Investor", "jane@example.com", "24", "125.25", dividend_1.paid_at.to_s, payment_1.created_at.to_s, "wise", "cde456", "119.0", "115.0", "6.0", "5", "2.0"],
        [dividend_2.company.name, dividend_2.id.to_s, "John M Gumroad", "john@example.com", "60", "250.0", dividend_2.paid_at.to_s, payment_2.created_at.to_s, "wise", "xyz789", "246.0", "240.0", "4.0", "0", "0.0"],
        [dividend_4.company.name, dividend_4.id.to_s, "Cat Woman", "catwoman@example.com", "100", "250.0", dividend_4.paid_at.to_s, payment_3.created_at.to_s, "wise", "fgnfgn67", "246.0", "240.0", "4.0", "15", "10.0"],
        [dividend_5.company.name, dividend_5.id.to_s, "Cat Woman", "catwoman@example.com", "100", "250.0", dividend_5.paid_at.to_s, payment_3.created_at.to_s, "wise", "fgnfgn67", "246.0", "240.0", "4.0", "16", "10.0"],
      ]
    end
  end
end
