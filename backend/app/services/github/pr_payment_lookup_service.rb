# frozen_string_literal: true

module Github
  class PrPaymentLookupService
    attr_reader :company

    def initialize(company:)
      @company = company
    end

    def find_paid_invoices_for_pr(pr_url)
      return [] if pr_url.blank?

      InvoiceLineItem
        .joins(invoice: :company)
        .where(github_pr_url: pr_url)
        .where(invoices: { company_id: company.id, status: Invoice::PAID_OR_PAYING_STATES })
        .includes(invoice: :user)
        .map do |line_item|
          {
            invoice_id: line_item.invoice.id,
            invoice_external_id: line_item.invoice.external_id,
            invoice_number: line_item.invoice.invoice_number,
            invoice_date: line_item.invoice.invoice_date,
            invoice_status: line_item.invoice.status,
            contractor_name: line_item.invoice.user.legal_name || line_item.invoice.user.email,
            amount_cents: line_item.total_amount_cents
          }
        end
    end

    def pr_previously_paid?(pr_url, exclude_invoice_id: nil)
      return false if pr_url.blank?

      query = InvoiceLineItem
        .joins(invoice: :company)
        .where(github_pr_url: pr_url)
        .where(invoices: { company_id: company.id, status: Invoice::PAID_OR_PAYING_STATES })

      query = query.where.not(invoices: { id: exclude_invoice_id }) if exclude_invoice_id.present?

      query.exists?
    end

    def find_all_invoices_for_pr(pr_url)
      return [] if pr_url.blank?

      InvoiceLineItem
        .joins(invoice: :company)
        .where(github_pr_url: pr_url)
        .where(invoices: { company_id: company.id })
        .includes(invoice: :user)
        .map do |line_item|
          {
            invoice_id: line_item.invoice.id,
            invoice_external_id: line_item.invoice.external_id,
            invoice_number: line_item.invoice.invoice_number,
            invoice_date: line_item.invoice.invoice_date,
            invoice_status: line_item.invoice.status,
            contractor_name: line_item.invoice.user.legal_name || line_item.invoice.user.email,
            amount_cents: line_item.total_amount_cents,
            is_paid: Invoice::PAID_OR_PAYING_STATES.include?(line_item.invoice.status)
          }
        end
    end
  end
end
