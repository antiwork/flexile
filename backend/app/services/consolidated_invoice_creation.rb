# frozen_string_literal: true

class ConsolidatedInvoiceCreation
  attr_reader :company_id, :invoice_ids

  def initialize(company_id:, invoice_ids: [])
    @company_id = company_id
    @invoice_ids = invoice_ids
  end

  def process
    raise "Should not generate consolidated invoice for company #{company.id}" unless company.active? && company.bank_account_ready?

    consolidated_invoice = company.consolidated_invoices.build(
      invoice_date: Date.current,
      invoice_number: "FX-#{company.consolidated_invoices.count + 1}",
      status: ConsolidatedInvoice::SENT
    )

    return if invoices.empty?

    amount = 0
    fee_amount = 0
    invoices.each do |invoice|
      consolidated_invoice.consolidated_invoices_invoices.build(invoice:)
      amount += invoice.cash_amount_in_cents
      fee_amount += invoice.flexile_fee_cents
    end

    consolidated_invoice.period_start_date = invoices.first.invoice_date
    consolidated_invoice.period_end_date = invoices.last.invoice_date
    consolidated_invoice.invoice_amount_cents = amount
    consolidated_invoice.flexile_fee_cents = fee_amount
    consolidated_invoice.transfer_fee_cents = 0
    consolidated_invoice.total_cents = consolidated_invoice.invoice_amount_cents +
                                         consolidated_invoice.transfer_fee_cents +
                                          consolidated_invoice.flexile_fee_cents
    consolidated_invoice.save!
    invoices.each { |invoice| invoice.update!(status: Invoice::PAYMENT_PENDING) if invoice.payable? }
    consolidated_invoice
  end

  private
    def company
      @_company ||= Company.find(company_id)
    end

    def invoices
      return @_invoices if defined?(@_invoices)

      @_invoices = company.invoices.for_next_consolidated_invoice
      @_invoices = @_invoices.where(id: invoice_ids) if invoice_ids.present?
      @_invoices = @_invoices.order(invoice_date: :asc)
    end
end
