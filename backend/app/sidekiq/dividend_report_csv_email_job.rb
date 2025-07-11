# frozen_string_literal: true

class DividendReportCsvEmailJob
  include Sidekiq::Job
  sidekiq_options retry: 5

  def perform(recipients, year = nil, month = nil)
    return unless Rails.env.production?

    target_year = year || Time.current.year
    target_month = month || Time.current.month

    start_date = Date.new(target_year, target_month, 1)
    end_date = start_date.end_of_month

    dividend_rounds = DividendRound.includes(:dividends, :company, dividends: [:dividend_payments, company_investor: :user])
                                   .joins(:dividends)
                                   .where("dividend_rounds.issued_at >= ? AND dividend_rounds.issued_at <= ?",
                                          start_date, end_date)
                                   .distinct
                                   .order(issued_at: :asc)

    attached = { "DividendReport.csv" => DividendReportCsv.new(dividend_rounds).generate }
    AdminMailer.custom(to: recipients, subject: "Flexile Dividend Report CSV", body: "Attached", attached:).deliver_later
  end
end
