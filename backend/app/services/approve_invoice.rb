# frozen_string_literal: true

class ApproveInvoice
  INVOICE_STATUSES_THAT_DENY_APPROVAL = Invoice::PAID_OR_PAYING_STATES + [Invoice::FAILED]

  def initialize(invoice:, approver:)
    @invoice = invoice
    @approver = approver
  end

  def perform
    invoice.with_lock do
      return unless can_approve?

      invoice.reload.invoice_approvals.find_or_create_by!(approver:)
      invoice.update!(status: Invoice::APPROVED)
      return unless invoice.company.active? && invoice.fully_approved?

      CompanyWorkerMailer.invoice_approved(invoice_id: invoice.id).deliver_later if invoice.created_by_user?
    end
  end

  private
    attr_reader :invoice, :approver

    def can_approve?
      !invoice.status.in?(INVOICE_STATUSES_THAT_DENY_APPROVAL)
    end
end
