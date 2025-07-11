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
        subject: "Flexile Dividend Report CSV",
        body: "Attached",
        attached: hash_including("DividendReport.csv" => DividendReportCsv.new([dividend_round]).generate)
      )
    end

    it "includes only current month's dividend rounds in the CSV when no parameters provided" do
      other_round = create(
        :dividend_round,
        company: company,
        issued_at: Time.current.beginning_of_month - 2.months
      )
      create(:dividend, dividend_round: other_round, company:, company_investor:, status: Dividend::PAID)
      
      current_month_round = create(
        :dividend_round,
        company: company,
        issued_at: Time.current.beginning_of_month + 2.days
      )
      create(:dividend, dividend_round: current_month_round, company:, company_investor:, status: Dividend::PAID)
      
      expect do
        described_class.new.perform(recipients)
      end.to have_enqueued_mail(AdminMailer, :custom).with(
        to: recipients,
        subject: "Flexile Dividend Report CSV",
        body: "Attached",
        attached: hash_including("DividendReport.csv" => DividendReportCsv.new([current_month_round]).generate)
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
        subject: "Flexile Dividend Report CSV",
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
        subject: "Flexile Dividend Report CSV",
        body: "Attached",
        attached: hash_including("DividendReport.csv" => DividendReportCsv.new([specific_round]).generate)
      )
    end

    it "defaults to current month and year when no parameters provided" do
      current_round = create(
        :dividend_round,
        company:,
        issued_at: Time.current.beginning_of_month + 2.days
      )
      create(:dividend, dividend_round: current_round, company:, company_investor:, status: Dividend::PAID)

      expect do
        described_class.new.perform(recipients)
      end.to have_enqueued_mail(AdminMailer, :custom).with(
        to: recipients,
        subject: "Flexile Dividend Report CSV",
        body: "Attached",
        attached: hash_including("DividendReport.csv" => DividendReportCsv.new([current_round]).generate)
      )
    end

    it "filters correctly by specified year and month" do
      june_round = create(:dividend_round, company:, issued_at: Date.new(2023, 6, 15))
      july_round = create(:dividend_round, company:, issued_at: Date.new(2023, 7, 15))
      
      create(:dividend, dividend_round: june_round, company:, company_investor:, status: Dividend::PAID)
      create(:dividend, dividend_round: july_round, company:, company_investor:, status: Dividend::PAID)

      expect do
        described_class.new.perform(recipients, 2023, 6)
      end.to have_enqueued_mail(AdminMailer, :custom).with(
        to: recipients,
        subject: "Flexile Dividend Report CSV", 
        body: "Attached",
        attached: hash_including("DividendReport.csv" => DividendReportCsv.new([june_round]).generate)
      )
    end
  end
end
