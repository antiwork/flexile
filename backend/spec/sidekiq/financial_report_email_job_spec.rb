# frozen_string_literal: true

RSpec.describe FinancialReportEmailJob do
  describe "#perform" do
    let(:recipients) { ["admin@example.com", "cfo@example.com"] }

    before do
      allow(Rails.env).to receive(:production?).and_return(true)
    end

    it "sends email with invoices, dividends, and grouped CSV attachments" do
      company = create(:company, name: "TestCo")

      create(:consolidated_invoice, company: company, created_at: 1.week.ago)

      dividend_round = create(:dividend_round, company: company, issued_at: 1.week.ago)
      dividend = create(:dividend, company: company, dividend_round: dividend_round)
      create(:dividend_payment, dividend: dividend, status: Payment::SUCCEEDED, created_at: 1.week.ago)

      expect(AdminMailer).to receive(:custom).with(
        to: recipients,
        subject: match(/Financial report \d{4}-\d{2}/),
        body: "Attached",
        attached: hash_including(
          "invoices.csv" => kind_of(String),
          "dividends.csv" => kind_of(String),
          "grouped.csv" => kind_of(String)
        )
      ).and_return(double(deliver_later: true))

      described_class.new.perform(recipients)
    end

    it "does not run in non-production environments" do
      allow(Rails.env).to receive(:production?).and_return(false)

      expect(AdminMailer).not_to receive(:custom)

      described_class.new.perform(recipients)
    end
  end
end
