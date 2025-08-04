# frozen_string_literal: true

class VestingReportCsvEmailJob
  include Sidekiq::Job
  sidekiq_options retry: 5

  def perform(year = nil, month = nil)
    return unless Rails.env.production? || Rails.env.test?

    target_year = year || Time.current.last_month.year
    target_month = month || Time.current.last_month.month

    start_date = Date.new(target_year, target_month, 1)
    end_date = start_date.end_of_month

    companies_with_vesting = Company.joins(company_investors: { equity_grants: :vesting_events })
                                   .where(vesting_events: { vesting_date: start_date..end_date })
                                   .where(vesting_events: { processed_at: start_date..end_date, cancelled_at: nil })
                                   .distinct

    companies_with_vesting.each do |company|
      send_report_for_company(company, target_year, target_month)
    end
  end

  private
    def send_report_for_company(company, target_year, target_month)
      admin_emails = company.company_administrators.includes(:user).map(&:email)
      return if admin_emails.empty?

      subject = "Monthly Vesting Report - #{company.name} - #{Date::MONTHNAMES[target_month]} #{target_year}"
      csv_data = VestingReportCsv.new(company, target_year, target_month).generate
      attached = { "VestingReport_#{company.name.gsub(/[^A-Za-z0-9]/, '_')}_#{target_year}-#{target_month.to_s.rjust(2, '0')}.csv" => csv_data }

      body = VestingReportEmailBody.new(company, target_year, target_month).generate
      AdminMailer.custom(to: admin_emails, subject: subject, body: body, attached: attached).deliver_later
    end
end
