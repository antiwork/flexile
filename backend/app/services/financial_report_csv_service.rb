# frozen_string_literal: true

# Usage:
=begin
start_date = Date.parse("1 August 2025")
end_date = start_date.end_of_month
attached = FinancialReportCsvService.new(start_date:, end_date:).process
AdminMailer.custom(to: ["sahil@gumroad.com", "olson_steven@yahoo.com"], subject: "Financial report #{start_date.strftime("%B %Y")}", body: "Attached", attached:).deliver_now
=end
class FinancialReportCsvService
  def initialize(start_date:, end_date:)
    @start_date = start_date
    @end_date = end_date
  end

  def process
    raise "Start date must be before end date" if start_date > end_date
    report_date = start_date.strftime("%B %Y")

    {
      "invoices-#{report_date}.csv" => generate_csv(invoices_csv_columns, invoices_data),
      "dividends-#{report_date}.csv" => generate_csv(dividends_csv_columns, dividends_data),
      "grouped-#{report_date}.csv" => generate_csv(grouped_csv_columns, grouped_data),
      "stock_options-#{report_date}.csv" => generate_csv(stock_options_csv_columns, stock_options_data),
    }
  end

  private
    attr_reader :start_date, :end_date

    def generate_csv(columns, data)
      headers = columns.map { |col| col[:header] }

      CSV.generate do |csv|
        csv << headers
        data.each do |row_hash|
          csv << columns.map { |col| row_hash[col[:key]] }
        end

        csv << calculate_csv_totals(data, columns, columns.first[:key]) if data.any?
      end
    end

    def calculate_csv_totals(data, columns, first_column_key)
      return [] if data.empty?

      totals_hash = {}
      columns.each do |col|
        if col[:summable]
          totals_hash[col[:key]] = data.sum { |row| row[col[:key]].to_f }
        end
      end

      columns.map do |col|
        if col[:key] == first_column_key
          "TOTAL"
        elsif col[:summable]
          totals_hash[col[:key]]
        else
          ""
        end
      end
    end

    def invoices_data
      consolidated_invoices.each_with_object([]) do |ci, rows|
        payments = ci.consolidated_payments

        ci.invoices.alive.each do |invoice|
          status = invoice.status
          status = "open" if status == Invoice::RECEIVED
          invoice_payments = invoice.payments
          wise_recipients = WiseRecipient.where(id: invoice_payments.pluck(:wise_recipient_id))

          rows << {
            invoice_date: ci.invoice_date.to_fs(:us_date),
            payment_succeeded_at: payments.pluck(:succeeded_at).reject(&:blank?).map { _1.to_fs(:us_date) }.join(";"),
            consolidated_invoice_id: ci.id,
            client_name: ci.company.name,
            invoiced_amount_usd: ci.invoice_amount_cents / 100.0,
            flexile_fees_usd: ci.flexile_fee_usd,
            transfer_fees_usd: ci.transfer_fee_cents / 100.0,
            total_amount_usd: ci.total_amount_in_usd,
            stripe_fee_usd: payments.pluck(:stripe_fee_cents).reject(&:blank?).map { _1.zero? ? 0 : _1 / 100.0 }.join(";"),
            consolidated_invoice_status: ci.status,
            stripe_payment_intent_id: payments.pluck(:stripe_payment_intent_id).reject(&:blank?).join(";"),
            contractor_name: invoice.user.legal_name,
            wise_account_holder_name: wise_recipients.pluck(:account_holder_name).uniq.join(";"),
            wise_recipient_id: wise_recipients.pluck(:recipient_id).uniq.join(";"),
            invoice_id: invoice.id,
            wise_transfer_id: invoice_payments.pluck(:wise_transfer_id).reject(&:blank?).join(";"),
            cash_amount_usd: invoice.cash_amount_in_usd,
            equity_amount_usd: invoice.equity_amount_in_usd,
            invoice_total_amount_usd: invoice.total_amount_in_usd,
            invoice_status: status,
          }
        end
      end
    end

    def dividends_data
      dividends.each_with_object([]) do |dividend, rows|
        payments = dividend.dividend_payments.select { _1.status == Payment::SUCCEEDED }
        next if payments.empty?
        payment = payments.first

        flexile_fee = FlexileFeeCalculator.calculate_dividend_fee_cents(dividend.total_amount_in_cents) / 100.0

        rows << {
          date_initiated: payment.created_at.to_fs(:us_date),
          date_paid: dividend.paid_at&.to_fs(:us_date),
          client_name: dividend.company.name,
          dividend_round_id: dividend.dividend_round_id,
          dividend_id: dividend.id,
          investor_name: dividend.company_investor.user.legal_name,
          investor_email: dividend.company_investor.user.email,
          number_of_shares: dividend.number_of_shares,
          dividend_amount_usd: dividend.total_amount_in_cents / 100.0,
          processor: payment.processor_name,
          transfer_id: payment.transfer_id,
          total_transaction_amount_usd: payment.total_transaction_cents / 100.0,
          net_amount_usd: dividend.net_amount_in_cents / 100.0,
          transfer_fee_usd: payment.transfer_fee_in_cents ? payment.transfer_fee_in_cents / 100.0 : 0.0,
          tax_withholding_percentage: dividend.withholding_percentage,
          tax_withheld_usd: dividend.withheld_tax_cents / 100.0,
          flexile_fee_usd: flexile_fee,
          dividend_round_status: dividend.dividend_round.status,
        }
      end
    end

    def grouped_data
      rows = []

      consolidated_invoices.each do |ci|
        ci.invoices.alive.each do |invoice|
          rows << {
            type: "Invoice",
            date: ci.invoice_date.to_fs(:us_date),
            client_name: ci.company.name,
            description: "Invoice ##{invoice.id} - #{invoice.user.legal_name}",
            amount_usd: invoice.total_amount_in_usd,
            flexile_fee_usd: ci.flexile_fee_usd,
            transfer_fee_usd: ci.transfer_fee_cents / 100.0,
            net_amount_usd: invoice.total_amount_in_usd - ci.flexile_fee_usd - (ci.transfer_fee_cents / 100.0),
          }
        end
      end

      dividends.each do |dividend|
        payments = dividend.dividend_payments.select { _1.status == Payment::SUCCEEDED }
        next if payments.empty?
        payment = payments.first

        flexile_fee_usd = FlexileFeeCalculator.calculate_dividend_fee_cents(dividend.total_amount_in_cents) / 100.0
        transfer_fee = payment.transfer_fee_in_cents ? payment.transfer_fee_in_cents / 100.0 : 0.0

        rows << {
          type: "Dividend",
          date: dividend.paid_at&.to_fs(:us_date) || payment.created_at.to_fs(:us_date),
          client_name: dividend.company.name,
          description: "Dividend ##{dividend.id} - #{dividend.company_investor.user.legal_name}",
          amount_usd: dividend.total_amount_in_cents / 100.0,
          flexile_fee_usd:,
          transfer_fee_usd: transfer_fee,
          net_amount_usd: dividend.net_amount_in_cents / 100.0,
        }
      end

      rows.sort_by { |row| Date.parse(row[:date]) rescue Date.today }
    end

    def stock_options_data
      rows = []
      vesting_events = VestingEvent.not_cancelled.processed
                                    .joins(equity_grant: { company_investor: [:user, :company] })
                                    .where(processed_at: start_date..end_date)
                                    .includes(equity_grant: { company_investor: [:user, :company] })
      vesting_events.each do |vesting_event|
        equity_grant = vesting_event.equity_grant
        company = equity_grant.company_investor.company
        user = equity_grant.company_investor.user

        current_price = equity_grant.share_price_usd
        exercise_price = equity_grant.exercise_price_usd
        expiration_date = equity_grant.expires_at

        option_value_per_share = BlackScholesCalculator.calculate_option_value(
          current_price:,
          exercise_price:,
          expiration_date:
        )

        total_option_expense = option_value_per_share * vesting_event.vested_shares

        rows << {
          date_vested: vesting_event.processed_at.to_fs(:us_date),
          company_name: company.name,
          investor_name: user.legal_name,
          investor_email: user.email,
          grant_id: equity_grant.id,
          vesting_event_id: vesting_event.id,
          shares_vested: vesting_event.vested_shares,
          exercise_price_usd: exercise_price,
          current_share_price_usd: current_price,
          expiration_date: expiration_date.to_fs(:us_date),
          black_scholes_option_value: option_value_per_share.round(4),
          total_option_expense: total_option_expense.round(2),
          grant_type: equity_grant.option_grant_type&.upcase || "N/A",
          grant_status: equity_grant.cancelled_at? ? "Cancelled" : "Active",
        }
      end

      rows.sort_by { |row| Date.parse(row[:date_vested]) rescue Date.today }
    end

    def consolidated_invoices
      @_consolidated_invoices ||= ConsolidatedInvoice.includes(:company, :consolidated_payments, invoices: :payments)
                                                  .where("created_at >= ? AND created_at <= ?", start_date, end_date)
                                                  .order(created_at: :asc)
    end

    def dividends
      @_dividends ||= Dividend.includes(:dividend_payments, company_investor: :user)
                              .paid
                              .references(:dividend_payments)
                              .merge(DividendPayment.successful)
                              .where("dividend_payments.created_at >= ? AND dividend_payments.created_at <= ?", start_date, end_date)
                              .order(created_at: :asc)
    end

    def invoices_csv_columns
      [
        { key: :invoice_date, header: "Invoice date", summable: false },
        { key: :payment_succeeded_at, header: "Payment succeeded at", summable: false },
        { key: :consolidated_invoice_id, header: "Consolidated invoice ID", summable: false },
        { key: :client_name, header: "Client name", summable: false },
        { key: :invoiced_amount_usd, header: "Invoiced amount (USD)", summable: true },
        { key: :flexile_fees_usd, header: "Flexile fees (USD)", summable: true },
        { key: :transfer_fees_usd, header: "Transfer fees (USD)", summable: true },
        { key: :total_amount_usd, header: "Total amount (USD)", summable: true },
        { key: :stripe_fee_usd, header: "Stripe fee (USD)", summable: true },
        { key: :consolidated_invoice_status, header: "Consolidated invoice status", summable: false },
        { key: :stripe_payment_intent_id, header: "Stripe payment intent ID", summable: false },
        { key: :contractor_name, header: "Contractor name", summable: false },
        { key: :wise_account_holder_name, header: "Wise account holder name", summable: false },
        { key: :wise_recipient_id, header: "Wise recipient ID", summable: false },
        { key: :invoice_id, header: "Invoice ID", summable: false },
        { key: :wise_transfer_id, header: "Wise transfer ID", summable: false },
        { key: :cash_amount_usd, header: "Cash amount (USD)", summable: true },
        { key: :equity_amount_usd, header: "Equity amount (USD)", summable: true },
        { key: :invoice_total_amount_usd, header: "Total amount (USD)", summable: true },
        { key: :invoice_status, header: "Invoice status", summable: false }
      ]
    end

    def dividends_csv_columns
      [
        { key: :date_initiated, header: "Date initiated", summable: false },
        { key: :date_paid, header: "Date paid", summable: false },
        { key: :client_name, header: "Client name", summable: false },
        { key: :dividend_round_id, header: "Dividend round ID", summable: false },
        { key: :dividend_id, header: "Dividend ID", summable: false },
        { key: :investor_name, header: "Investor name", summable: false },
        { key: :investor_email, header: "Investor email", summable: false },
        { key: :number_of_shares, header: "Number of shares", summable: true },
        { key: :dividend_amount_usd, header: "Dividend amount (USD)", summable: true },
        { key: :processor, header: "Processor", summable: false },
        { key: :transfer_id, header: "Transfer ID", summable: false },
        { key: :total_transaction_amount_usd, header: "Total transaction amount (USD)", summable: true },
        { key: :net_amount_usd, header: "Net amount (USD)", summable: true },
        { key: :transfer_fee_usd, header: "Transfer fee (USD)", summable: true },
        { key: :tax_withholding_percentage, header: "Tax withholding percentage", summable: false },
        { key: :tax_withheld_usd, header: "Tax withheld", summable: true },
        { key: :flexile_fee_usd, header: "Flexile fee (USD)", summable: true },
        { key: :dividend_round_status, header: "Dividend round status", summable: false }
      ]
    end

    def grouped_csv_columns
      [
        { key: :type, header: "Type", summable: false },
        { key: :date, header: "Date", summable: false },
        { key: :client_name, header: "Client name", summable: false },
        { key: :description, header: "Description", summable: false },
        { key: :amount_usd, header: "Amount (USD)", summable: true },
        { key: :flexile_fee_usd, header: "Flexile fee (USD)", summable: true },
        { key: :transfer_fee_usd, header: "Transfer fee (USD)", summable: true },
        { key: :net_amount_usd, header: "Net amount (USD)", summable: true }
      ]
    end

    def stock_options_csv_columns
      [
        { key: :date_vested, header: "Date Vested", summable: false },
        { key: :company_name, header: "Company Name", summable: false },
        { key: :investor_name, header: "Investor Name", summable: false },
        { key: :investor_email, header: "Investor Email", summable: false },
        { key: :grant_id, header: "Grant ID", summable: false },
        { key: :vesting_event_id, header: "Vesting Event ID", summable: false },
        { key: :shares_vested, header: "Shares Vested", summable: true },
        { key: :exercise_price_usd, header: "Exercise Price (USD)", summable: false },
        { key: :current_share_price_usd, header: "Current Share Price (USD)", summable: false },
        { key: :expiration_date, header: "Expiration Date", summable: false },
        { key: :black_scholes_option_value, header: "Black-Scholes Option Value", summable: false },
        { key: :total_option_expense, header: "Total Option Expense", summable: true },
        { key: :grant_type, header: "Grant Type", summable: false },
        { key: :grant_status, header: "Grant Status", summable: false }
      ]
    end
end
