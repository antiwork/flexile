# frozen_string_literal: true

class ApproveAndPayOrChargeForInvoices
  class InvoiceNotPayableError < StandardError; end

  attr_reader :deferred_invoices

  def initialize(user:, company:, invoice_ids:)
    @user = user
    @company = company
    @invoice_ids = invoice_ids
    @deferred_invoices = []
  end

  def perform
    invoices = invoice_ids.map { |external_id| company.invoices.alive.find_by!(external_id:) } # Load everything up front so we can validate the batch before mutating.

    chargeable_invoice_ids = []

    invoices.each do |invoice|
      ApproveInvoice.new(invoice:, approver: user).perform
    end

    invoices.each do |invoice|
      invoice.reload
      reason = payability_hold_reason(invoice)

      if reason
        # Instead of failing the whole batch we capture why this invoice can't move forward yet.
        deferred_invoices << deferred_payload(invoice, reason)
        next
      end

      if invoice.immediately_payable? # for example, invoice payment failed
        EnqueueInvoicePayment.new(invoice:).perform
      elsif invoice.payable? && !invoice.company_charged?
        chargeable_invoice_ids << invoice.id
      end
    end

    result = nil
    if chargeable_invoice_ids.any?
      result = ConsolidatedInvoiceCreation.new(company_id: company.id, invoice_ids: chargeable_invoice_ids).process
      ChargeConsolidatedInvoiceJob.perform_async(result.id) if result.present?
    end

    result
  end

  private
    attr_reader :user, :company, :invoice_ids

    def payability_hold_reason(invoice)
      # Each branch matches the prerequisites surfaced in the UI so admins get actionable feedback.
      return "Flexile needs a company payout account before you can send contractor payments." unless company.bank_account_ready?

      remaining = approvals_remaining(invoice)
      if remaining.positive?
        approver_word = remaining == 1 ? "approval" : "approvals"
        return "This invoice needs #{remaining} more #{approver_word} before it can be paid."
      end

      unless invoice.created_by_user? || invoice.accepted_at.present?
        return "#{invoice.user.display_name} must accept their Flexile invite before this invoice can be paid."
      end

      return "#{invoice.user.display_name} must complete tax information before this invoice can be paid." unless invoice.tax_requirements_met?

      return "#{invoice.user.display_name} must add payout details before this invoice can be paid." unless invoice.user.bank_account.present?

      nil
    end

    def deferred_payload(invoice, message)
      {
        invoice_id: invoice.external_id,
        invoice_number: invoice.invoice_number,
        message:,
      }
    end

    def approvals_remaining(invoice)
      [company.required_invoice_approval_count - invoice.invoice_approvals_count, 0].max
    end
end
