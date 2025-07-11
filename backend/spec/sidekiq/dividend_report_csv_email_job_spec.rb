# frozen_string_literal: true

RSpec.describe DividendReportCsvEmailJob, :vcr do
  describe "#perform" do
    let(:recipients) { ["admin@example.com", "cfo@example.com"] }
    let(:company) { create(:company, name: "TestCo") }
    let(:dividend_round) do
      create(
        :dividend_round,
        company:,
        issued_at: Time.current.beginning_of_month + 2.days
      )
    end
    let(:user) { create(:user) }
    let(:company_investor) { create(:company_investor, company:, user:) }
    let!(:dividend) do
      create(
        :dividend,
        dividend_round:,
        company:,
        company_investor:,
        status: Dividend::PAID,
        total_amount_in_cents: 100_00,
        paid_at: Time.current.beginning_of_month + 3.days
      )
    end

    before do
      allow(Rails).to receive(:env).and_return(ActiveSupport::StringInquirer.new("production"))
    end

    it "does not send email if not in production" do
      allow(Rails).to receive(:env).and_return(ActiveSupport::StringInquirer.new("development"))
      expect do
        described_class.new.perform(recipients)
      end.not_to have_enqueued_mail(AdminMailer, :custom)
    end

    it "sends an email with the correct CSV attachment" do
      expect do
        described_class.new.perform(recipients)
      end.to have_enqueued_mail(AdminMailer, :custom).with(
        to: recipients,
        subject: "Flexile Dividend Report CSV #{Time.current.year}-#{Time.current.month.to_s.rjust(2, '0')}",
        body: "Attached",
        attached: hash_including("DividendReport.csv" => DividendReportCsv.new([dividend_round]).generate)
      )
    end

    it "includes only last month's dividend rounds in the CSV" do
      other_round = create(
        :dividend_round,
        company: company,
        issued_at: Time.current.beginning_of_month - 2.months
      )
      create(:dividend, dividend_round: other_round, company:, company_investor:, status: Dividend::PAID)

      expect do
        described_class.new.perform(recipients)
      end.to have_enqueued_mail(AdminMailer, :custom).with(
        to: recipients,
        subject: "Flexile Dividend Report CSV #{Time.current.year}-#{Time.current.month.to_s.rjust(2, '0')}",
        body: "Attached",
        attached: hash_including("DividendReport.csv" => DividendReportCsv.new([dividend_round]).generate)
      )
    end

    it "orders dividend rounds by issued_at ascending" do
      round1 = create(:dividend_round, company:, issued_at: Time.current.beginning_of_month + 1.day)
      round2 = create(:dividend_round, company:, issued_at: Time.current.beginning_of_month + 5.days)
      create(:dividend, dividend_round: round1, company:, company_investor:, status: Dividend::PAID)
      create(:dividend, dividend_round: round2, company:, company_investor:, status: Dividend::PAID)

      expect do
        described_class.new.perform(recipients)
      end.to have_enqueued_mail(AdminMailer, :custom).with(
        to: recipients,
        subject: "Flexile Dividend Report CSV #{Time.current.year}-#{Time.current.month.to_s.rjust(2, '0')}",
        body: "Attached",
        attached: hash_including("DividendReport.csv" => DividendReportCsv.new([round1, dividend_round, round2]).generate)
      )
    end

    it "accepts year and month parameters" do
      specific_date = Date.new(2023, 6, 15)
      specific_round = create(
        :dividend_round,
        company:,
        issued_at: specific_date
      )
      create(:dividend, dividend_round: specific_round, company:, company_investor:, status: Dividend::PAID)

      expect do
        described_class.new.perform(recipients, 2023, 6)
      end.to have_enqueued_mail(AdminMailer, :custom).with(
        to: recipients,
        subject: "Flexile Dividend Report CSV 2023-06",
        body: "Attached",
        attached: hash_including("DividendReport.csv" => DividendReportCsv.new([specific_round]).generate)
      )
    end
  end
end
