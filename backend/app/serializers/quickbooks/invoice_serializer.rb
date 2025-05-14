# frozen_string_literal: true

class Quickbooks::InvoiceSerializer < BaseSerializer
  delegate :user, :company, :invoice_line_items, :invoice_expenses, :invoice_number, :invoice_date,
           :cash_amount_in_cents, :integration_external_id, :sync_token, to: :object

  def initialize(object)
    super
    @calculated_cash_amount_in_cents = 0
  end

  def attributes
    result = {
      DocNumber: invoice_number,
      TxnDate: invoice_date.iso8601,
      VendorRef: { value: quickbooks_vendor_id },
    }
    result[:Line] = (invoice_line_items + invoice_expenses).map.with_index(&method(:serialized_line_item))

    # Since we calculate the total amount in USD by summing the line items, we need to adjust for rounding error
    # compared to the total amount in USD that we store in the database for the invoice.
    adjust_for_rounding_error(result[:Line])

    result[:Id] = integration_external_id if integration_external_id.present?
    result[:SyncToken] = sync_token if sync_token.present?
    result
  end

  def quickbooks_vendor_id
    company_worker.integration_external_id
  end

  private
    def company_worker
      @_company_worker ||= user.company_workers.find_by(company:)
    end

    def integration
      @_integration ||= company.quickbooks_integration
    end

    def serialized_line_item(line_item, position)
      @calculated_cash_amount_in_cents += line_item.cash_amount_in_cents

      result = {
        Description: "Inv ##{invoice_number} - #{line_item.description}",
        DetailType: "AccountBasedExpenseLineDetail",
        Amount: line_item.cash_amount_in_usd,
        AccountBasedExpenseLineDetail: {
          AccountRef: {
            value: line_item.is_a?(InvoiceExpense) ? line_item.expense_account_id : integration.consulting_services_expense_account_id,
          },
        },
        LineNum: position + 1,
      }
      result[:Id] = line_item.integration_external_id if line_item.integration_external_id.present?
      result
    end

    def adjust_for_rounding_error(serialized_line_items)
      adjustment_amount = (cash_amount_in_cents - @calculated_cash_amount_in_cents) / 100.to_d

      return if adjustment_amount.zero?

      serialized_line_items.first[:Amount] = (serialized_line_items.first[:Amount].to_d + adjustment_amount).to_f
    end
end
