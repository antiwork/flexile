# frozen_string_literal: true

class ConsolidatedInvoiceCreation
  attr_reader :company_id, :invoice_ids

  def initialize(company_id:, invoice_ids: [])
    @company_id = company_id
    @invoice_ids = invoice_ids
  end

  def process
    raise "Should not generate consolidated invoice for company #{company.id}" unless company.active? && company.bank_account_ready?

    return [] if invoices.empty?

    invoices_by_date = invoices.group_by(&:invoice_date)
    consolidated_invoices = []

    invoices_by_date.each do |invoice_date, daily_invoices|
      consolidated_invoice = company.consolidated_invoices.build(
        invoice_date: Date.current,
        invoice_number: "FX-#{company.consolidated_invoices.count + consolidated_invoices.count + 1}",
        status: ConsolidatedInvoice::SENT
      )

      amount = 0
      fee_amount = 0
      daily_invoices.each do |invoice|
        consolidated_invoice.consolidated_invoices_invoices.build(invoice:)
        amount += invoice.cash_amount_in_cents
        fee_amount += invoice.flexile_fee_cents
      end

      # For daily grouping, start and end dates are the same
      consolidated_invoice.period_start_date = invoice_date
      consolidated_invoice.period_end_date = invoice_date
      consolidated_invoice.invoice_amount_cents = amount
      consolidated_invoice.flexile_fee_cents = fee_amount
      consolidated_invoice.transfer_fee_cents = 0
      consolidated_invoice.total_cents = consolidated_invoice.invoice_amount_cents +
                                           consolidated_invoice.transfer_fee_cents +
                                            consolidated_invoice.flexile_fee_cents
      consolidated_invoice.save!
      daily_invoices.each { |invoice| invoice.update!(status: Invoice::PAYMENT_PENDING) if invoice.payable? }
      consolidated_invoices << consolidated_invoice
    end

    consolidated_invoices.length == 1 ? consolidated_invoices.first : consolidated_invoices
  end

  private
    def company
      @_company ||= Company.find(company_id)
    end

    def invoices
      return @_invoices if defined?(@_invoices)

      @_invoices = company.invoices.alive.for_next_consolidated_invoice
      @_invoices = @_invoices.where(id: invoice_ids) if invoice_ids.present?
      @_invoices = @_invoices.order(invoice_date: :asc)
    end
end
