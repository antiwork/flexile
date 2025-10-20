# frozen_string_literal: true

class ApproveAndPayOrChargeForInvoices
  class InvoiceNotPayableError < StandardError; end

  def initialize(user:, company:, invoice_ids:)
    @user = user
    @company = company
    @invoice_ids = invoice_ids
  end

  def perform
    invoices = invoice_ids.map { |external_id| company.invoices.alive.find_by!(external_id:) } # Load everything up front so we can validate the batch before mutating.

    if (reason = preflight_payability_issue(invoices))
      raise InvoiceNotPayableError, reason
    end

    chargeable_invoice_ids = []
    invoices.each do |invoice|
      ApproveInvoice.new(invoice:, approver: user).perform
      invoice.reload
      ensure_invoice_can_be_paid!(invoice) # Abort with guidance if key billing prerequisites are still missing.

      if invoice.immediately_payable? # for example, invoice payment failed
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

    def preflight_payability_issue(invoices)
      invoices.each do |invoice|
        reason = first_payability_issue_for(invoice, post_approval: false)
        return "Invoice #{invoice.invoice_number}: #{reason}" if reason # Stop before any approvals/enqueues happen.
      end
      nil
    end

    def ensure_invoice_can_be_paid!(invoice)
      reason = first_payability_issue_for(invoice, post_approval: true)
      raise InvoiceNotPayableError, reason if reason
    end

    def first_payability_issue_for(invoice, post_approval:)
      return "Flexile needs a company payout account before you can send contractor payments." unless company.bank_account_ready? # Company must finish payout setup.

      approvals_remaining = approvals_remaining_after_current_user(invoice, post_approval:)
      if approvals_remaining.positive?
        approver_word = approvals_remaining == 1 ? "approval" : "approvals"
        return "This invoice needs #{approvals_remaining} more #{approver_word} before it can be paid."
      end

      unless invoice.created_by_user? || invoice.accepted_at.present?
        return "#{invoice.user.display_name} must accept their Flexile invite before this invoice can be paid." # Prevent payments to unaccepted invites.
      end

      return "#{invoice.user.display_name} must complete tax information before this invoice can be paid." unless invoice.tax_requirements_met? # IRS compliance before payouts.

      return "#{invoice.user.display_name} must add payout details before this invoice can be paid." unless invoice.user.bank_account.present? # Wise recipient record required.

      nil
    end

    def approvals_remaining_after_current_user(invoice, post_approval:)
      remaining = company.required_invoice_approval_count - invoice.invoice_approvals_count
      remaining -= 1 unless post_approval || invoice.invoice_approvals.exists?(approver: user) # Acting admin’s approval is about to be recorded.
      [remaining, 0].max
    end
end
