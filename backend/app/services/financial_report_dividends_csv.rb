# frozen_string_literal: true

class FinancialReportDividendsCsv
  HEADERS = ["Type", "Date initiated", "Date paid", "Client name", "Dividend round ID", "Dividend ID",
             "Investor name", "Investor email", "Number of shares", "Dividend amount", "Processor",
             "Transfer ID", "Total transaction amount", "Net amount", "Transfer fee", "Tax withholding percentage",
             "Tax withheld", "Flexile fee cents", "Round status", "Total investors in round"]

  def initialize(dividends, dividend_rounds)
    @dividends = dividends
    @dividend_rounds = dividend_rounds
  end

  def generate
    data = combined_dividend_data
    CSV.generate do |csv|
      csv << HEADERS
      data.each do |row|
        csv << row
      end

      # Add summation row
      if data.any?
        totals = calculate_totals(data)
        csv << totals
      end
    end
  end

  private
    def combined_dividend_data
      rows = []

      # Add individual dividend payment records
      @dividends.each do |dividend|
        payments = dividend.dividend_payments.select { _1.status == Payment::SUCCEEDED }
        next if payments.empty?
        payment = payments.first

        flexile_fee_cents = FlexileFeeCalculator.calculate_dividend_fee_cents(dividend.total_amount_in_cents)

        rows << [
          "Individual Payment",
          payment.created_at.to_fs(:us_date),
          dividend.paid_at&.to_fs(:us_date),
          dividend.company.name,
          dividend.dividend_round_id,
          dividend.id,
          dividend.company_investor.user.legal_name,
          dividend.company_investor.user.email,
          dividend.number_of_shares,
          dividend.total_amount_in_cents / 100.0,
          payment.processor_name,
          payment.transfer_id,
          payment.total_transaction_cents / 100.0,
          dividend.net_amount_in_cents / 100.0,
          payment.transfer_fee_in_cents ? payment.transfer_fee_in_cents / 100.0 : nil,
          dividend.withholding_percentage,
          dividend.withheld_tax_cents / 100.0,
          flexile_fee_cents,
          "",
          ""
        ]
      end

      # Add dividend round summary records
      @dividend_rounds.each do |dividend_round|
        dividends = dividend_round.dividends
        total_dividends = dividends.sum(:total_amount_in_cents) / 100.0
        total_transfer_fees = dividends.joins(:dividend_payments)
                                       .where(dividend_payments: { status: Payments::Status::SUCCEEDED })
                                       .sum("dividend_payments.transfer_fee_in_cents") / 100.0

        flexile_fees_cents = dividends.map do |dividend|
          FlexileFeeCalculator.calculate_dividend_fee_cents(dividend.total_amount_in_cents)
        end.sum

        rows << [
          "Round Summary",
          dividend_round.issued_at.to_fs(:us_date),
          dividends.paid.first&.paid_at&.to_fs(:us_date),
          dividend_round.company.name,
          dividend_round.id,
          "",
          "",
          "",
          "",
          total_dividends,
          "",
          "",
          "",
          "",
          total_transfer_fees,
          "",
          "",
          flexile_fees_cents,
          dividend_round.status,
          dividends.count
        ]
      end

      # Sort by date initiated
      rows.sort_by { |row| Date.parse(row[1]) rescue Date.today }
    end

    def calculate_totals(data)
      return [] if data.empty?

      # Calculate totals for numeric columns
      number_of_shares_total = data.sum { |row| row[8].to_f }
      dividend_amount_total = data.sum { |row| row[9].to_f }
      total_transaction_amount_total = data.sum { |row| row[12].to_f }
      net_amount_total = data.sum { |row| row[13].to_f }
      transfer_fee_total = data.sum { |row| row[14].to_f }
      tax_withheld_total = data.sum { |row| row[16].to_f }
      flexile_fee_cents_total = data.sum { |row| row[17].to_i }

      [
        "TOTAL", "", "", "", "", "", "", "",
        number_of_shares_total,
        dividend_amount_total,
        "", "",
        total_transaction_amount_total,
        net_amount_total,
        transfer_fee_total,
        "",
        tax_withheld_total,
        flexile_fee_cents_total,
        "",
        ""
      ]
    end
end
