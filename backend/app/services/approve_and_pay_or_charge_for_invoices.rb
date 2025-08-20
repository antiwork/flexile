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
      invoice = company.invoices.alive.find_by!(external_id:)
      ApproveInvoice.new(invoice:, approver: user).perform
      if invoice.reload.immediately_payable? # for example, invoice payment failed
        EnqueueInvoicePayment.new(invoice:).perform
      elsif invoice.payable? && !invoice.company_charged?
        chargeable_invoice_ids << invoice.id
      end
    end
    return if chargeable_invoice_ids.empty?

    consolidated_invoices = ConsolidatedInvoiceCreation.new(company_id: company.id, invoice_ids: chargeable_invoice_ids).process
    if consolidated_invoices.is_a?(Array)
      consolidated_invoices.each { |ci| ChargeConsolidatedInvoiceJob.perform_async(ci.id) }
    else
      ChargeConsolidatedInvoiceJob.perform_async(consolidated_invoices.id)
    end
    consolidated_invoices
  end

  private
    attr_reader :user, :company, :invoice_ids
end
