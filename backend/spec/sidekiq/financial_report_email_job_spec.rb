# frozen_string_literal: true

RSpec.describe MonthlyFinancialReportEmailJob do
  describe "#perform" do
    let(:recipients) { ["solson@earlygrowth.com", "sahil@gumroad.com"] }

    it "sends email with financial report CSV attachments" do
      company = create(:company, name: "TestCo")
      last_month = Date.today.last_month

      create(:consolidated_invoice, company:, created_at: last_month.beginning_of_month + 1.day)

      dividend_round = create(:dividend_round, company:, issued_at: last_month.beginning_of_month + 1.day)
      dividend = create(:dividend, company:, dividend_round:)
      create(:dividend_payment, dividends: [dividend], status: Payment::SUCCEEDED, created_at: last_month.beginning_of_month + 1.day)

      company_investor = create(:company_investor, company:)
      option_pool = create(:option_pool, company:)
      equity_grant = create(:equity_grant, company_investor:, option_pool:)
      create(:vesting_event, equity_grant: equity_grant, processed_at: last_month.beginning_of_month + 1.day)

      expected_subject = "Flexile monthly financial report - #{last_month.strftime("%B %Y")}"
      expected_report_date = last_month.strftime("%B %Y")

      expect(AdminMailer).to receive(:custom).with(
        to: recipients,
        subject: expected_subject,
        body: "Attached",
        attached: hash_including(
          "invoices-#{expected_report_date}.csv" => kind_of(String),
          "dividends-#{expected_report_date}.csv" => kind_of(String),
          "grouped-#{expected_report_date}.csv" => kind_of(String),
          "stock_options-#{expected_report_date}.csv" => kind_of(String)
        )
      ).and_return(double(deliver_later: true))

      described_class.new.perform(recipients)
    end
  end
end
