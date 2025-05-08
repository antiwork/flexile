# frozen_string_literal: true

class RejectInvoice
  INVOICE_STATUSES_THAT_DENY_REJECTION = Invoice::PAID_OR_PAYING_STATES + [Invoice::FAILED]

  def initialize(invoice:, rejected_by:, reason: nil)
    @invoice = invoice
    @rejected_by = rejected_by
    @reason = reason
  end

  def perform
    invoice.with_lock do
      return unless can_reject?

      invoice.reload.update!(status: Invoice::REJECTED, rejected_by:, rejection_reason: reason, rejected_at: Time.current)
      CompanyWorkerMailer.invoice_rejected(invoice_id: invoice.id, reason:).deliver_later
    end
  end

  private
    attr_reader :invoice, :rejected_by, :reason

    def can_reject?
      !invoice.status.in?(INVOICE_STATUSES_THAT_DENY_REJECTION)
    end
end
