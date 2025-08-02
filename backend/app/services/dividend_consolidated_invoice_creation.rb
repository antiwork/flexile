# frozen_string_literal: true

class DividendConsolidatedInvoiceCreation
  attr_reader :dividend_round

  def initialize(dividend_round)
    @dividend_round = dividend_round
  end

  def process
    raise "Company #{company.id} is not active" unless company.active?
    raise "Company #{company.id} does not have a ready bank account" unless company.bank_account_ready?

    dividend_round.with_lock do
      dividend_amount_cents = dividend_round.total_amount_in_cents
      fee_cents = dividend_round.flexile_fees_in_cents

      consolidated_invoice = company.consolidated_invoices.create!(
        invoice_date: Date.current,
        invoice_number: "FX-DIV-#{company.consolidated_invoices.count + 1}",
        status: ConsolidatedInvoice::SENT,
        period_start_date: dividend_round.issued_at.to_date,
        period_end_date: dividend_round.issued_at.to_date,
        invoice_amount_cents: dividend_amount_cents,
        flexile_fee_cents: fee_cents,
        transfer_fee_cents: 0,
        total_cents: dividend_amount_cents + fee_cents,
      )

      dividend_round.update!(consolidated_invoice: consolidated_invoice)
      consolidated_invoice
    end
  end

  private
    def company
      dividend_round.company
    end
end
