# frozen_string_literal: true

class FinancialReportEmailJob
  include Sidekiq::Job
  sidekiq_options retry: 5

  def perform(recipients)
    return unless Rails.env.production?

    invoices = ConsolidatedInvoice.includes(:company, :consolidated_payments, invoices: :payments)
                                  .where("created_at > ?", Time.current.last_month.beginning_of_month)
                                  .order(created_at: :asc)
    consolidated_invoices_csv = ConsolidatedInvoiceCsv.new(invoices).generate

    dividends = Dividend.includes(:dividend_payments, company_investor: :user)
                        .paid
                        .references(:dividend_payments)
                        .merge(DividendPayment.successful)
                        .where("dividend_payments.created_at > ?", Time.current.last_month.beginning_of_month)
                        .order(created_at: :asc)
    dividend_payments_csv = DividendPaymentCsv.new(dividends).generate

    target_year = Time.current.last_month.year
    target_month = Time.current.last_month.month
    start_date = Date.new(target_year, target_month, 1)
    end_date = start_date.end_of_month

    dividend_rounds = DividendRound.includes(:dividends, :company, dividends: [:dividend_payments, company_investor: :user])
                                   .joins(:dividends)
                                   .where("dividend_rounds.issued_at >= ? AND dividend_rounds.issued_at <= ?",
                                          start_date, end_date)
                                   .distinct
                                   .order(issued_at: :asc)
    dividend_report_csv = DividendReportCsv.new(dividend_rounds).generate

    subject = "Financial report #{target_year}-#{target_month.to_s.rjust(2, '0')}"
    attached = {
      "ConsolidatedInvoices.csv" => consolidated_invoices_csv,
      "DividendPayments.csv" => dividend_payments_csv,
      "DividendReport.csv" => dividend_report_csv,
    }

    AdminMailer.custom(to: recipients, subject: subject, body: "Attached", attached: attached).deliver_later
  end
end
