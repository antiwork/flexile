# frozen_string_literal: true

class DeleteInvoice
  DELETABLE_INVOICE_STATUSES = [Invoice::RECEIVED, Invoice::APPROVED]

  def initialize(invoice:, deleted_by:)
    @invoice = invoice
    @deleted_by = deleted_by
  end

  def perform
    invoice.with_lock do
      return unless can_delete?

      invoice.mark_deleted!
    end
  end

    private
      attr_reader :invoice, :deleted_by

      def can_delete?
        invoice.status.in?(DELETABLE_INVOICE_STATUSES)
      end
end
