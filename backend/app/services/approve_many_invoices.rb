# frozen_string_literal: true

class ApproveManyInvoices
  def initialize(company:, approver:, invoice_ids:)
    @company = company
    @approver = approver
    @invoice_ids = invoice_ids
  end

  def perform
    invoices = company.invoices.alive.where(external_id: invoice_ids)
    raise ActiveRecord::RecordNotFound if invoices.size != invoice_ids.size

    invoices.each do |invoice|
      ApproveInvoice.new(invoice:, approver:).perform
    end
  end

  private
    attr_reader :company, :approver, :invoice_ids
end
