# frozen_string_literal: true

RSpec.describe VestingReportCsvEmailJob do
  describe "#perform" do
    let(:company) { create(:company, name: "TestCo") }
    let(:admin_user) { create(:user, legal_name: "Admin User", email: "admin@testco.com") }
    let!(:company_admin) { create(:company_administrator, company: company, user: admin_user) }

    let(:investor_user) { create(:user, legal_name: "John Doe") }
    let(:company_investor) { create(:company_investor, company: company, user: investor_user) }
    let(:equity_grant) { create(:equity_grant, company_investor: company_investor) }

    let!(:vesting_event) do
      create(:vesting_event,
             equity_grant: equity_grant,
             vesting_date: Time.current.last_month.beginning_of_month + 15.days,
             processed_at: Time.current.last_month.beginning_of_month + 16.days,
             vested_shares: 1000,
             cancelled_at: nil)
    end

    it "sends vesting report emails to company admins" do
      expect do
        described_class.new.perform
      end.to have_enqueued_mail(AdminMailer, :custom).with(
        to: [admin_user.email],
        subject: "Monthly Vesting Report - TestCo - #{Date::MONTHNAMES[Time.current.last_month.month]} #{Time.current.last_month.year}",
        body: include("John Doe, 1000"),
        attached: hash_including("VestingReport_TestCo_#{Time.current.last_month.year}-#{Time.current.last_month.month.to_s.rjust(2, '0')}.csv" => include("John Doe"))
      )
    end

    it "does not send emails for companies with no vesting events" do
      vesting_event.update!(cancelled_at: Time.current)

      expect do
        described_class.new.perform
      end.not_to have_enqueued_mail(AdminMailer, :custom)
    end

    it "does not send emails for companies with no admins" do
      company_admin.destroy!

      expect do
        described_class.new.perform
      end.not_to have_enqueued_mail(AdminMailer, :custom)
    end

    it "only includes processed, non-cancelled vesting events" do
      create(:vesting_event,
             equity_grant: equity_grant,
             vesting_date: Time.current.last_month.beginning_of_month + 10.days,
             processed_at: nil,
             vested_shares: 500)

      create(:vesting_event,
             equity_grant: equity_grant,
             vesting_date: Time.current.last_month.beginning_of_month + 20.days,
             processed_at: Time.current.last_month.beginning_of_month + 21.days,
             cancelled_at: Time.current,
             vested_shares: 300)

      expect do
        described_class.new.perform
      end.to have_enqueued_mail(AdminMailer, :custom).with(
        to: [admin_user.email],
        subject: anything,
        body: include("John Doe, 1000"),
        attached: hash_including("VestingReport_TestCo_#{Time.current.last_month.year}-#{Time.current.last_month.month.to_s.rjust(2, '0')}.csv" => include("John Doe"))
      )
    end

    it "works with custom year and month parameters" do
      custom_date = 6.months.ago
      vesting_event.update!(
        vesting_date: custom_date.beginning_of_month + 10.days,
        processed_at: custom_date.beginning_of_month + 11.days
      )

      expect do
        described_class.new.perform(custom_date.year, custom_date.month)
      end.to have_enqueued_mail(AdminMailer, :custom).with(
        to: [admin_user.email],
        subject: "Monthly Vesting Report - TestCo - #{Date::MONTHNAMES[custom_date.month]} #{custom_date.year}",
        body: include("John Doe, 1000"),
        attached: anything
      )
    end
  end
end
