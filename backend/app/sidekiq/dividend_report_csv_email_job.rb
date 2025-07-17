# frozen_string_literal: true

class DividendReportCsvEmailJob
  include Sidekiq::Job
  sidekiq_options retry: 5

  def perform(recipients, year = nil, month = nil)
    return unless Rails.env.production? || Rails.env.test?

    target_year = year || Time.current.last_month.year
    target_month = month || Time.current.last_month.month

    start_date = Date.new(target_year, target_month, 1)
    end_date = start_date.end_of_month

    dividend_rounds = DividendRound.includes(:dividends, :company, dividends: [:dividend_payments, company_investor: :user])
                                   .joins(:dividends)
                                   .where("dividend_rounds.issued_at >= ? AND dividend_rounds.issued_at <= ?",
                                          start_date, end_date)
                                   .distinct
                                   .order(issued_at: :asc)

    subject = "Flexile Dividend Report CSV #{target_year}-#{target_month.to_s.rjust(2, '0')}"
    attached = { "DividendReport.csv" => DividendReportCsv.new(dividend_rounds).generate }
    AdminMailer.custom(to: recipients, subject: subject, body: "Attached", attached:).deliver_later
  end
end
