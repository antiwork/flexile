# frozen_string_literal: true

RSpec.describe DividendReportCsv do
  describe "#generate" do
    it "includes data for dividend rounds with successful payments" do
      company = create(:company, name: "Test Company")
      dividend_round = create(:dividend_round, company: company, issued_at: 1.week.ago)
      company_investor = create(:company_investor, company: company)
      dividend = create(:dividend,
                        company: company,
                        dividend_round: dividend_round,
                        company_investor: company_investor,
                        total_amount_in_cents: 10000,
                        status: Dividend::PAID,
                        paid_at: 1.day.ago)

      payment = create(:dividend_payment,
                       processor_name: DividendPayment::PROCESSOR_WISE,
                       transfer_id: "test123",
                       status: Payment::SUCCEEDED)
      dividend.dividend_payments << payment

      csv = described_class.new([dividend_round]).generate
      expect(csv).to include("Test Company")
      expect(csv).to include("100.0")
      expect(csv).to include("3.2")
    end
  end
end
