# frozen_string_literal: true

class FinancialReportGroupedCsv
  HEADERS = ["Type", "Date", "Client name", "Description", "Amount (USD)", "Flexile fee cents", "Transfer fee (USD)", "Net amount (USD)"]

  def initialize(consolidated_invoices, dividends)
    @consolidated_invoices = consolidated_invoices
    @dividends = dividends
  end

  def generate
    data = grouped_data
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
    def grouped_data
      rows = []

      # Add invoice data
      @consolidated_invoices.each do |ci|
        ci.invoices.alive.each do |invoice|
          flexile_fee_cents = (ci.flexile_fee_usd * 100).to_i
          rows << [
            "Invoice",
            ci.invoice_date.to_fs(:us_date),
            ci.company.name,
            "Invoice ##{invoice.id} - #{invoice.user.legal_name}",
            invoice.total_amount_in_usd,
            flexile_fee_cents,
            ci.transfer_fee_cents / 100.0,
            invoice.total_amount_in_usd - (flexile_fee_cents / 100.0) - (ci.transfer_fee_cents / 100.0)
          ]
        end
      end

      # Add dividend data
      @dividends.each do |dividend|
        payments = dividend.dividend_payments.select { _1.status == Payment::SUCCEEDED }
        next if payments.empty?
        payment = payments.first

        flexile_fee_cents = FlexileFeeCalculator.calculate_dividend_fee_cents(dividend.total_amount_in_cents)
        transfer_fee = payment.transfer_fee_in_cents ? payment.transfer_fee_in_cents / 100.0 : 0.0

        rows << [
          "Dividend",
          dividend.paid_at&.to_fs(:us_date) || payment.created_at.to_fs(:us_date),
          dividend.company.name,
          "Dividend ##{dividend.id} - #{dividend.company_investor.user.legal_name}",
          dividend.total_amount_in_cents / 100.0,
          flexile_fee_cents,
          transfer_fee,
          dividend.net_amount_in_cents / 100.0
        ]
      end

      # Sort by date
      rows.sort_by { |row| Date.parse(row[1]) rescue Date.today }
    end

    def calculate_totals(data)
      return [] if data.empty?

      # Calculate totals for numeric columns
      amount_total = data.sum { |row| row[4].to_f }
      flexile_fee_cents_total = data.sum { |row| row[5].to_i }
      transfer_fee_total = data.sum { |row| row[6].to_f }
      net_amount_total = data.sum { |row| row[7].to_f }

      [
        "TOTAL", "", "", "",
        amount_total,
        flexile_fee_cents_total,
        transfer_fee_total,
        net_amount_total
      ]
    end
end
