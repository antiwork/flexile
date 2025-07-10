# frozen_string_literal: true

class DividendReportCsvEmailJob
  include Sidekiq::Job
  sidekiq_options retry: 5

  def perform(recipients)
    return unless Rails.env.production?

    dividend_rounds = DividendRound.includes(:dividends, :company, dividends: [:dividend_payments, company_investor: :user])
                                   .joins(:dividends)
                                   .where("dividend_rounds.issued_at >= ? AND dividend_rounds.issued_at <= ?",
                                          Time.current.last_month.beginning_of_month,
                                          Time.current.last_month.end_of_month)
                                   .distinct
                                   .order(issued_at: :asc)

    attached = { "DividendReport.csv" => DividendReportCsv.new(dividend_rounds).generate }
    AdminMailer.custom(to: recipients, subject: "Flexile Dividend Report CSV", body: "Attached", attached:).deliver_later
  end
end
