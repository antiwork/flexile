# frozen_string_literal: true

# Usage:
=begin
# Get data for the last month
invoices = ConsolidatedInvoice.includes(:company, :consolidated_payments, invoices: :payments)
                              .where("created_at > ?", Time.current.last_month.beginning_of_month)
                              .order(created_at: :asc)

dividends = Dividend.includes(:dividend_payments, company_investor: :user)
                    .paid
                    .references(:dividend_payments)
                    .merge(DividendPayment.successful)
                    .where("dividend_payments.created_at > ?", Time.current.last_month.beginning_of_month)
                    .order(created_at: :asc)

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

# Get vesting events for the last month
vesting_events = VestingEvent.not_cancelled.processed
                             .joins(equity_grant: { company_investor: [:user, :company] })
                             .where(processed_at: start_date..end_date)
                             .includes(equity_grant: { company_investor: [:user, :company] })

# Generate all CSV reports
service = FinancialReportCsvService.new(invoices, dividends, dividend_rounds, vesting_events)
attached = service.generate_all

# Send email with all four CSV attachments
AdminMailer.custom(to: ["solson@earlygrowth.com", "sahil@gumroad.com"],
                   subject: "Financial report #{target_year}-#{target_month.to_s.rjust(2, '0')}",
                   body: "Attached",
                   attached: attached).deliver_now
=end

class FinancialReportCsvService
  def initialize(consolidated_invoices, dividends, dividend_rounds, vesting_events = [])
    @consolidated_invoices = consolidated_invoices
    @dividends = dividends
    @dividend_rounds = dividend_rounds
    @vesting_events = vesting_events
  end

  def generate_all
    {
      "invoices.csv" => generate_invoices_csv,
      "dividends.csv" => generate_dividends_csv,
      "grouped.csv" => generate_grouped_csv,
      "stock_options.csv" => generate_stock_options_csv,
    }
  end

  private
    def generate_invoices_csv
      headers = ["Date initiated", "Date succeeded", "Consolidated invoice ID", "Client name", "Invoiced amount", "Flexile fees", "Transfer fees", "Total amount", "Stripe fee",
                 "Consolidated invoice status", "Stripe payment intent ID", "Contractor name", "Wise account holder name", "Wise recipient ID", "Invoice ID", "Wise transfer ID",
                 "Cash amount (USD)", "Equity amount (USD)", "Total amount (USD)", "Status", "Flexile fee cents"]

      data = consolidated_invoice_data
      CSV.generate do |csv|
        csv << headers
        data.each do |row|
          csv << row
        end

        if data.any?
          totals = calculate_invoices_totals(data)
          csv << totals
        end
      end
    end

    def generate_dividends_csv
      headers = ["Type", "Date initiated", "Date paid", "Client name", "Dividend round ID", "Dividend ID",
                 "Investor name", "Investor email", "Number of shares", "Dividend amount", "Processor",
                 "Transfer ID", "Total transaction amount", "Net amount", "Transfer fee", "Tax withholding percentage",
                 "Tax withheld", "Flexile fee cents", "Round status", "Total investors in round"]

      data = combined_dividend_data
      CSV.generate do |csv|
        csv << headers
        data.each do |row|
          csv << row
        end

        if data.any?
          totals = calculate_dividends_totals(data)
          csv << totals
        end
      end
    end

    def generate_grouped_csv
      headers = ["Type", "Date", "Client name", "Description", "Amount (USD)", "Flexile fee cents", "Transfer fee (USD)", "Net amount (USD)"]

      data = grouped_data
      CSV.generate do |csv|
        csv << headers
        data.each do |row|
          csv << row
        end

        if data.any?
          totals = calculate_grouped_totals(data)
          csv << totals
        end
      end
    end

    def consolidated_invoice_data
      @consolidated_invoices.each_with_object([]) do |ci, row|
        payments = ci.consolidated_payments
        ci_data = [
          ci.invoice_date.to_fs(:us_date),
          payments.pluck(:succeeded_at).reject(&:blank?).map { _1.to_fs(:us_date) }.join(";"),
          ci.id,
          ci.company.name,
          ci.invoice_amount_cents / 100.0,
          ci.flexile_fee_usd,
          ci.transfer_fee_cents / 100.0,
          ci.total_amount_in_usd,
          payments.pluck(:stripe_fee_cents).reject(&:blank?).map { _1.zero? ? 0 : _1 / 100.0 }.join(";"),
          ci.status,
          payments.pluck(:stripe_payment_intent_id).reject(&:blank?).join(";"),
        ]
        ci.invoices.alive.each do |invoice|
          status = invoice.status
          status = "open" if status == Invoice::RECEIVED
          payments = invoice.payments
          wise_recipients = WiseRecipient.where(id: payments.pluck(:wise_recipient_id))
          flexile_fee_cents = (ci.flexile_fee_usd * 100).to_i
          row << ci_data + [
            invoice.user.legal_name,
            wise_recipients.pluck(:account_holder_name).uniq.join(";"),
            wise_recipients.pluck(:recipient_id).uniq.join(";"),
            invoice.id,
            payments.pluck(:wise_transfer_id).reject(&:blank?).join(";"),
            invoice.cash_amount_in_usd,
            invoice.equity_amount_in_usd,
            invoice.total_amount_in_usd,
            status,
            flexile_fee_cents,
          ]
        end
      end
    end

    def combined_dividend_data
      rows = []

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

      rows.sort_by { |row| Date.parse(row[1]) rescue Date.today }
    end

    def grouped_data
      rows = []

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

      rows.sort_by { |row| Date.parse(row[1]) rescue Date.today }
    end

    def calculate_invoices_totals(data)
      return [] if data.empty?

      invoiced_amount_total = data.sum { |row| row[4].to_f }
      flexile_fees_total = data.sum { |row| row[5].to_f }
      transfer_fees_total = data.sum { |row| row[6].to_f }
      total_amount_total = data.sum { |row| row[7].to_f }
      cash_amount_total = data.sum { |row| row[16].to_f }
      equity_amount_total = data.sum { |row| row[17].to_f }
      invoice_total_amount_total = data.sum { |row| row[18].to_f }
      flexile_fee_cents_total = data.sum { |row| row[20].to_i }

      [
        "TOTAL", "", "", "",
        invoiced_amount_total,
        flexile_fees_total,
        transfer_fees_total,
        total_amount_total,
        "", "", "", "", "", "", "", "",
        cash_amount_total,
        equity_amount_total,
        invoice_total_amount_total,
        "",
        flexile_fee_cents_total
      ]
    end

    def calculate_dividends_totals(data)
      return [] if data.empty?

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

    def calculate_grouped_totals(data)
      return [] if data.empty?

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

    def stock_options_data
      target_year = Time.current.last_month.year
      target_month = Time.current.last_month.month
      start_date = Date.new(target_year, target_month, 1)
      end_date = start_date.end_of_month

      filtered_vesting_events = @vesting_events.select do |vesting_event|
        vesting_event.processed_at >= start_date && vesting_event.processed_at <= end_date
      end

      rows = []
      filtered_vesting_events.each do |vesting_event|
        equity_grant = vesting_event.equity_grant
        company = equity_grant.company_investor.company
        user = equity_grant.company_investor.user

        current_price = equity_grant.share_price_usd
        exercise_price = equity_grant.exercise_price_usd
        time_to_expiration = calculate_time_to_expiration(equity_grant.expires_at)

        option_value_per_share = BlackScholesCalculator.calculate_option_value(
          current_price: current_price,
          exercise_price: exercise_price,
          time_to_expiration_years: time_to_expiration
        )

        total_option_expense = option_value_per_share * vesting_event.vested_shares

        rows << [
          vesting_event.processed_at.to_fs(:us_date),
          company.name,
          user.legal_name,
          user.email,
          equity_grant.id,
          vesting_event.id,
          vesting_event.vested_shares,
          exercise_price,
          current_price,
          time_to_expiration.round(4),
          option_value_per_share.round(4),
          total_option_expense.round(2),
          equity_grant.option_grant_type&.upcase || "N/A",
          equity_grant.cancelled_at? ? "Cancelled" : "Active"
        ]
      end

      rows.sort_by { |row| Date.parse(row[0]) rescue Date.today }
    end

    def calculate_time_to_expiration(expires_at)
      return 0.0 unless expires_at

      days_to_expiration = (expires_at.to_date - Date.current).to_f
      [days_to_expiration / 365.25, 0.0].max
    end

    def calculate_stock_options_totals(data)
      return [] if data.empty?

      total_shares_vested = data.sum { |row| row[6].to_f }
      total_option_expense = data.sum { |row| row[11].to_f }

      [
        "TOTAL", "", "", "", "", "",
        total_shares_vested,
        "", "", "",
        "",
        total_option_expense,
        "",
        ""
      ]
    end
end
