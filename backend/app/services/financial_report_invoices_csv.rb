# frozen_string_literal: true

class FinancialReportInvoicesCsv
  HEADERS = ["Date initiated", "Date succeeded", "Consolidated invoice ID", "Client name", "Invoiced amount", "Flexile fees", "Transfer fees", "Total amount", "Stripe fee",
             "Consolidated invoice status", "Stripe payment intent ID", "Contractor name", "Wise account holder name", "Wise recipient ID", "Invoice ID", "Wise transfer ID",
             "Cash amount (USD)", "Equity amount (USD)", "Total amount (USD)", "Status", "Flexile fee cents"]

  def initialize(consolidated_invoices)
    @consolidated_invoices = consolidated_invoices
  end

  def generate
    data = consolidated_invoice_data
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

    def calculate_totals(data)
      return [] if data.empty?

      # Calculate totals for numeric columns
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
end
