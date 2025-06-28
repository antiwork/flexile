# frozen_string_literal: true

class DeleteManyInvoices
  def initialize(company:, deleted_by:, invoice_ids:)
    @company = company
    @deleted_by = deleted_by
    @invoice_ids = invoice_ids
  end

  def perform
    invoices = company.invoices.alive.where(external_id: invoice_ids)
    raise ActiveRecord::RecordNotFound if invoices.size != invoice_ids.size

    invoices.each do |invoice|
      DeleteInvoice.new(invoice:, deleted_by:).perform
    end
  end

    private
      attr_reader :company, :deleted_by, :invoice_ids
end
