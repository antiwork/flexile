# frozen_string_literal: true

class ProcessPayableInvoices
  def initialize(company:, user: nil)
    @company = company
    @user = user
  end

  def perform
    return unless company.active?
    return unless company.bank_account_ready?

    chargeable_invoice_ids = []

    scope.each do |invoice|
      next unless invoice.payable?
      # Skip auto-queueing until the contractor has payout details so PayInvoice doesn't raise.
      next unless invoice.user.bank_account.present?

      if invoice.immediately_payable?
        EnqueueInvoicePayment.new(invoice:).perform
      elsif !invoice.company_charged?
        chargeable_invoice_ids << invoice.id
      end
    end

    return if chargeable_invoice_ids.empty?

    consolidated_invoice = ConsolidatedInvoiceCreation.new(company_id: company.id, invoice_ids: chargeable_invoice_ids).process
    # Using the same job keeps retry semantics consistent with manual approvals.
    ChargeConsolidatedInvoiceJob.perform_async(consolidated_invoice.id) if consolidated_invoice.present?
  end

  private
    attr_reader :company, :user

    def scope
      invoices = company.invoices.alive.for_next_consolidated_invoice
      invoices = invoices.where(user:) if user
      # Oldest first so we don't skip invoices stuck behind newer submissions.
      invoices.order(invoice_date: :asc)
    end
end
