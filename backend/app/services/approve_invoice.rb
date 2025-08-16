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

      # Check if equity grant is required before allowing approval
      if requires_equity_grant?
        invoice.errors.add(:base, "Admin must create an equity grant before this invoice can be approved")
        raise ActiveRecord::RecordInvalid.new(invoice)
      end

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

    def requires_equity_grant?
      return false unless invoice.company.equity_enabled?
      return false if invoice.company_worker.equity_percentage.zero?

      # Check if equity calculation would fail due to missing/insufficient grants
      services_in_cents = invoice.total_amount_in_usd_cents - (invoice.invoice_expenses.sum(&:total_amount_in_cents) || 0)
      equity_calculation_result = InvoiceEquityCalculator.new(
        company_worker: invoice.company_worker,
        company: invoice.company,
        service_amount_cents: services_in_cents,
        invoice_year: invoice.invoice_date.year,
      ).calculate

      equity_calculation_result.nil?
    end
end
