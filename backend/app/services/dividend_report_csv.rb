# frozen_string_literal: true

class DividendReportCsv
  HEADERS = ["Date initiated", "Date paid", "Client name", "Total dividends ($)", "Flexile fees ($)",
             "Transfer fees ($)", "Total ACH pull ($)", "Number of investors", "Dividend round status"]

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
      @dividend_rounds.each_with_object([]) do |dividend_round, rows|
        dividends = dividend_round.dividends
        total_dividends = dividends.sum(:total_amount_in_cents) / 100.0
        total_transfer_fees = dividends.joins(:dividend_payments)
                                       .where(dividend_payments: { status: Payments::Status::SUCCEEDED })
                                       .sum("dividend_payments.transfer_fee_in_cents") / 100.0

        flexile_fees = dividends.map do |dividend|
          calculated_fee = ((dividend.total_amount_in_cents.to_d * 2.9.to_d / 100.to_d) + 30.to_d).round.to_i
          [30_00, calculated_fee].min
        end.sum / 100.0

        total_ach_pull = total_dividends + flexile_fees

        rows << [
          dividend_round.issued_at.to_fs(:us_date),
          dividends.paid.first&.paid_at&.to_fs(:us_date),
          dividend_round.company.name,
          total_dividends,
          flexile_fees,
          total_transfer_fees,
          total_ach_pull,
          dividends.count,
          dividend_round.status,
        ]
      end
    end
end
