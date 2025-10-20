# frozen_string_literal: true

class ApproveAndPayOrChargeForInvoices
  class InvoiceNotPayableError < StandardError; end

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

    def ensure_invoice_can_be_paid!(invoice)
      reason = first_payability_issue_for(invoice)
      raise InvoiceNotPayableError, reason if reason
    end

    def first_payability_issue_for(invoice)
      return "Flexile needs a company payout account before you can send contractor payments." unless company.bank_account_ready? # Company must finish payout setup.

      approvals_remaining = company.required_invoice_approval_count - invoice.invoice_approvals_count
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
end
