# frozen_string_literal: true

class InvoicePresenter
  include ActionView::Helpers::TextHelper

  delegate :user, :company, :invoice_approvals, :external_id, :invoice_number,
           :invoice_date, :payment_expected_by, :paid_at, :bill_from, :bill_to, :created_at,
           :contractor_role, :total_amount_in_usd, :cash_amount_in_cents, :equity_amount_in_cents,
           :total_minutes, :description, :invoice_line_items, :invoice_expenses,
           :status, :rejected?, :rejected_by, :rejected_at, :attachment, :notes, :payable?, :user_id,
           :tax_requirements_met?, to: :invoice, allow_nil: true

  def initialize(invoice)
    @invoice = invoice
  end

  def new_form_props(contractor:)
    total_minutes = 0
    new_invoice_date = DefaultInvoiceDate.new(user, contractor.company).generate
    props = {
      user: user_props(contractor:),
      company: InvoicePresenter.company_props(company),
      invoice: {
        attachment: nil,
        bill_address: AddressPresenter.new(user).props,
        description: "",
        total_minutes:,
        invoice_date: new_invoice_date,
        invoice_number: @invoice.recommended_invoice_number,
        notes: nil,
        status: nil,
        rejected_by: nil,
        rejection_reason: nil,
        max_minutes: Invoice::MAX_MINUTES,
        equity_amount_in_cents: 0,
        line_items: [],
        expenses:,
      },
    }
    if company.equity_compensation_enabled?
      equity_allocation = contractor.equity_allocation_for(new_invoice_date.year)
      props[:equity_allocation] = {
        percentage: equity_allocation&.equity_percentage,
        is_locked: equity_allocation&.locked?,
      }
    end
    props
  end

  def edit_form_props(contractor:)
    props = new_form_props(contractor:).merge(
      {
        invoice: {
          id: external_id,
          attachment: attachment ? {
            name: attachment.filename,
            url: Rails.application.routes.url_helpers.rails_blob_path(attachment, disposition: "attachment"),
          } : nil,
          bill_address: AddressPresenter.new(invoice).props,
          description:,
          total_minutes:,
          invoice_date:,
          invoice_number:,
          notes:,
          status:,
          rejected_by: rejector_name,
          rejection_reason:,
          max_minutes: Invoice::MAX_MINUTES,
          total_amount_in_usd:,
          equity_amount_in_cents:,
          line_items:,
          expenses:,
        },
      }
    )
    if props[:equity_allocation]
      equity_allocation = contractor.equity_allocation_for(invoice_date.year)
      props[:equity_allocation] = {
        percentage: equity_allocation&.equity_percentage,
        is_locked: equity_allocation&.locked?,
      }
    end
    props
  end

  private
    attr_reader :invoice

    def user_props(contractor:)
      {
        legal_name: user.legal_name,
        business_entity: user.business_entity?,
        billing_entity_name: user.billing_entity_name,
        pay_rate_in_subunits: contractor.pay_rate_in_subunits,
        project_based: contractor.project_based?,
      }
    end

    def self.company_props(company)
      {
        id: company.external_id,
        name: company.name,
        address: AddressPresenter.new(company).props,
        is_trusted: company.is_trusted?,
        completed_payment_method_setup: company.bank_account_ready?,
        expenses: {
          enabled: company.expenses_enabled?,
          categories: company.expense_categories.map { |category| { id: category.id, name: category.name } }.sort_by { _1[:name] },
        },
      }
    end

    def line_items
      invoice_line_items.map do |line_item|
        line_item.attributes.symbolize_keys!.slice(:id, :description, :minutes, :pay_rate_in_subunits, :total_amount_cents)
      end
    end

    def expenses
      invoice_expenses.reject { _1.marked_for_destruction? }
                      .map do |expense|
        {
          id: expense.id,
          description: expense.description,
          category_id: expense.expense_category_id,
          total_amount_in_cents: expense.total_amount_in_cents,
          attachment: expense.attachment ? {
            name: expense.attachment.filename,
            url: Rails.application.routes.url_helpers.rails_blob_path(expense.attachment, disposition: "attachment"),
          } : nil,
        }
      end
    end

    def rejector_name(current_user = nil)
      return if rejected_by.nil?
      rejected_by == current_user ? "you" : rejected_by.name
    end

    def rejection_reason
      rejected? ? invoice.rejection_reason : nil
    end
end
