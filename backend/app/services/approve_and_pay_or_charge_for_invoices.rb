# frozen_string_literal: true

class ApproveAndPayOrChargeForInvoices
  def initialize(user:, company:, invoice_ids:)
    @user = user
    @company = company
    @invoice_ids = invoice_ids
  end

  def perform
    chargeable_invoice_ids = []
    invoice_ids.each do |external_id|
      invoice = company.invoices.find_by!(external_id:)
      ApproveInvoice.new(invoice:, approver: user).perform
      if invoice.reload.immediately_payable? # for example, invoice payment failed
        EnqueueInvoicePayment.new(invoice:).perform
      elsif invoice.payable? && !invoice.company_charged?
        chargeable_invoice_ids << invoice.id
      end
    end
    return if chargeable_invoice_ids.empty?

    consolidated_invoice = ConsolidatedInvoiceCreation.new(company_id: company.id, invoice_ids: chargeable_invoice_ids).process
    ChargeConsolidatedInvoiceJob.perform_async(consolidated_invoice.id)
    consolidated_invoice
  end

  private
    attr_reader :user, :company, :invoice_ids
end
