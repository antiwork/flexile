# frozen_string_literal: true

require "csv"

class DividendReportCsv
  HEADERS = ["Date initiated", "Date paid", "Dividend round ID", "Client name", "Total dividends",
             "Flexile fees", "Transfer fees", "Total ACH pull", "Number of investors",
             "Dividend round status", "Payment processor", "Transfer reference"]

  def initialize(dividend_rounds)
    @dividend_rounds = dividend_rounds
  end

  def generate
    data = dividend_round_data
    CSV.generate do |csv|
      csv << HEADERS
      data.each do |row|
        csv << row
      end
    end
  end

  private
    def dividend_round_data
      @dividend_rounds.each_with_object([]) do |round, rows|
        successful_dividends = round.dividends.joins(:dividend_payments)
                                   .merge(DividendPayment.successful)
                                   .includes(:dividend_payments, company_investor: :user)

        next if successful_dividends.empty?

        total_dividends = successful_dividends.sum(:total_amount_in_cents) / 100.0
        total_transfer_fees = successful_dividends.joins(:dividend_payments)
                                                 .sum("dividend_payments.transfer_fee_in_cents") / 100.0

        flexile_fees = successful_dividends.map do |dividend|
          calculated_fee = ((dividend.total_amount_in_cents.to_d * 2.9.to_d / 100.to_d) + 30.to_d).round.to_i
          [30_00, calculated_fee].min
        end.sum / 100.0

        total_ach_pull = total_dividends + flexile_fees + total_transfer_fees

        payment = successful_dividends.first.dividend_payments.successful.first
        rows << [
          round.issued_at.to_fs(:us_date),
          successful_dividends.first.paid_at&.to_fs(:us_date),
          round.id,
          round.company.name,
          total_dividends,
          flexile_fees,
          total_transfer_fees,
          total_ach_pull,
          successful_dividends.count,
          round.status,
          payment&.processor_name,
          payment&.transfer_id
        ]
      end
    end
end

### Usage:
=begin
dividend_rounds = DividendRound.includes(:dividends, :company, dividends: [:dividend_payments, company_investor: :user])
                               .where("issued_at > ?", Time.current.last_month.beginning_of_month)
                               .order(issued_at: :asc)
attached = { "DividendReport.csv" => DividendReportCsv.new(dividend_rounds).generate }
AdminMailer.custom(to: ["solson@earlygrowth.com"], subject: "Flexile Dividend Report CSV", body: "Attached", attached:).deliver_now
=end
