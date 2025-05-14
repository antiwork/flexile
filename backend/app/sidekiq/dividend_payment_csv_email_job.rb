# frozen_string_literal: true

class DividendPaymentCsvEmailJob
  include Sidekiq::Job
  sidekiq_options retry: 5

  def perform(recipients)
    return unless Rails.env.production?

    dividends = Dividend.includes(:dividend_payments, company_investor: :user)
                        .paid
                        .references(:dividend_payments)
                        .merge(DividendPayment.successful)
                        .where("dividend_payments.created_at > ?", Time.current.last_month.beginning_of_month)
                        .order(created_at: :asc)

    attached = { "DividendPayments.csv" => DividendPaymentCsv.new(dividends).generate }
    AdminMailer.custom(to: recipients, subject: "Flexile Dividend Payments CSV", body: "Attached", attached:).deliver_later
  end
end
