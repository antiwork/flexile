# frozen_string_literal: true

RSpec.describe DividendReportCsvEmailJob do
  describe "#perform" do
    let(:recipients) { ["admin@example.com", "cfo@example.com"] }
    let(:company) { create(:company, name: "TestCo") }
    let(:dividend_round) do
      create(
        :dividend_round,
        company:,
        issued_at: Time.current.last_month.beginning_of_month + 2.days
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
        paid_at: Time.current.last_month.beginning_of_month + 3.days
      )
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
        subject: "Flexile Dividend Report CSV #{Time.current.last_month.year}-#{Time.current.last_month.month.to_s.rjust(2, '0')}",
        body: "Attached",
        attached: hash_including("DividendReport.csv" => DividendReportCsv.new([dividend_round]).generate)
      )
    end

    it "includes only last month's dividend rounds in the CSV" do
      other_round = create(
        :dividend_round,
        company: company,
        issued_at: Time.current.last_month.beginning_of_month - 2.months
      )
      create(:dividend, dividend_round: other_round, company:, company_investor:, status: Dividend::PAID)

      expect do
        described_class.new.perform(recipients)
      end.to have_enqueued_mail(AdminMailer, :custom).with(
        to: recipients,
        subject: "Flexile Dividend Report CSV #{Time.current.last_month.year}-#{Time.current.last_month.month.to_s.rjust(2, '0')}",
        body: "Attached",
        attached: hash_including("DividendReport.csv" => DividendReportCsv.new([dividend_round]).generate)
      )
    end

    it "orders dividend rounds by issued_at ascending" do
      round1 = create(:dividend_round, company:, issued_at: Time.current.last_month.beginning_of_month + 1.day)
      round2 = create(:dividend_round, company:, issued_at: Time.current.last_month.beginning_of_month + 5.days)
      create(:dividend, dividend_round: round1, company:, company_investor:, status: Dividend::PAID)
      create(:dividend, dividend_round: round2, company:, company_investor:, status: Dividend::PAID)

      expect do
        described_class.new.perform(recipients)
      end.to have_enqueued_mail(AdminMailer, :custom).with(
        to: recipients,
        subject: "Flexile Dividend Report CSV #{Time.current.last_month.year}-#{Time.current.last_month.month.to_s.rjust(2, '0')}",
        body: "Attached",
        attached: hash_including("DividendReport.csv" => DividendReportCsv.new([round1, dividend_round, round2]).generate)
      )
    end

    context "when year and month parameters are provided" do
      let(:target_year) { 2023 }
      let(:target_month) { 6 }
      let(:custom_dividend_round) do
        create(
          :dividend_round,
          company:,
          issued_at: Date.new(target_year, target_month, 15)
        )
      end
      let!(:custom_dividend) do
        create(
          :dividend,
          dividend_round: custom_dividend_round,
          company:,
          company_investor:,
          status: Dividend::PAID,
          total_amount_in_cents: 200_00,
          paid_at: Date.new(target_year, target_month, 16)
        )
      end

      it "sends email with correct subject for custom year and month" do
        expect do
          described_class.new.perform(recipients, target_year, target_month)
        end.to have_enqueued_mail(AdminMailer, :custom).with(
          to: recipients,
          subject: "Flexile Dividend Report CSV 2023-06",
          body: "Attached",
          attached: hash_including("DividendReport.csv" => DividendReportCsv.new([custom_dividend_round]).generate)
        )
      end

      it "filters dividend rounds for the specified month and year" do
        other_month_round = create(
          :dividend_round,
          company:,
          issued_at: Date.new(target_year, target_month + 1, 10)
        )
        create(:dividend, dividend_round: other_month_round, company:, company_investor:, status: Dividend::PAID)

        expect do
          described_class.new.perform(recipients, target_year, target_month)
        end.to have_enqueued_mail(AdminMailer, :custom).with(
          to: recipients,
          subject: "Flexile Dividend Report CSV 2023-06",
          body: "Attached",
          attached: hash_including("DividendReport.csv" => DividendReportCsv.new([custom_dividend_round]).generate)
        )
      end

      it "handles single digit months with zero padding in subject" do
        march_year = 2023
        march_month = 3
        march_round = create(
          :dividend_round,
          company:,
          issued_at: Date.new(march_year, march_month, 10)
        )
        create(:dividend, dividend_round: march_round, company:, company_investor:, status: Dividend::PAID)

        expect do
          described_class.new.perform(recipients, march_year, march_month)
        end.to have_enqueued_mail(AdminMailer, :custom).with(
          to: recipients,
          subject: "Flexile Dividend Report CSV 2023-03",
          body: "Attached",
          attached: hash_including("DividendReport.csv" => DividendReportCsv.new([march_round]).generate)
        )
      end
    end

    context "with dividends in different statuses" do
      let(:dividend_round_mixed) do
        create(
          :dividend_round,
          company:,
          issued_at: Time.current.last_month.beginning_of_month - 1.month + 2.days
        )
      end
      let(:user2) { create(:user) }
      let(:company_investor2) { create(:company_investor, company:, user: user2) }
      let(:user3) { create(:user) }
      let(:company_investor3) { create(:company_investor, company:, user: user3) }
      let(:user4) { create(:user) }
      let(:company_investor4) { create(:company_investor, company:, user: user4) }
      let(:user5) { create(:user) }
      let(:company_investor5) { create(:company_investor, company:, user: user5) }

      let!(:paid_dividend) do
        create(
          :dividend,
          :paid,
          dividend_round: dividend_round_mixed,
          company:,
          company_investor:,
          total_amount_in_cents: 100_00,
          paid_at: Time.current.last_month.beginning_of_month + 3.days
        )
      end
      let!(:issued_dividend) do
        create(
          :dividend,
          dividend_round: dividend_round_mixed,
          company:,
          company_investor: company_investor2,
          status: Dividend::ISSUED,
          total_amount_in_cents: 200_00
        )
      end
      let!(:pending_dividend) do
        create(
          :dividend,
          :pending,
          dividend_round: dividend_round_mixed,
          company:,
          company_investor: company_investor3,
          total_amount_in_cents: 150_00
        )
      end
      let!(:retained_dividend) do
        create(
          :dividend,
          :retained,
          dividend_round: dividend_round_mixed,
          company:,
          company_investor: company_investor4,
          total_amount_in_cents: 75_00
        )
      end
      let!(:processing_dividend) do
        create(
          :dividend,
          :processing,
          dividend_round: dividend_round_mixed,
          company:,
          company_investor: company_investor5,
          total_amount_in_cents: 125_00
        )
      end

      it "includes all dividends regardless of status in the CSV" do
        target_year = (Time.current.last_month - 1.month).year
        target_month = (Time.current.last_month - 1.month).month

        expect do
          described_class.new.perform(recipients, target_year, target_month)
        end.to have_enqueued_mail(AdminMailer, :custom).with(
          to: recipients,
          subject: "Flexile Dividend Report CSV #{target_year}-#{target_month.to_s.rjust(2, '0')}",
          body: "Attached",
          attached: hash_including("DividendReport.csv" => DividendReportCsv.new([dividend_round_mixed]).generate)
        )
      end
    end
  end
end
