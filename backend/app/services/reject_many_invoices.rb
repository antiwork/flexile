# frozen_string_literal: true

class RejectManyInvoices
  def initialize(company:, rejected_by:, invoice_ids:, reason: nil)
    @company = company
    @rejected_by = rejected_by
    @invoice_ids = invoice_ids
    @reason = reason
  end

  def perform
    invoices = company.invoices.where(external_id: invoice_ids)
    raise ActiveRecord::RecordNotFound if invoices.size != invoice_ids.size

    invoices.each do |invoice|
      RejectInvoice.new(invoice:, rejected_by: rejected_by, reason: reason).perform
    end
  end

  private
    attr_reader :company, :rejected_by, :invoice_ids, :reason
end
