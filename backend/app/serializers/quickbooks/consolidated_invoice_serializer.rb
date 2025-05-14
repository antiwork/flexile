# frozen_string_literal: true

class Quickbooks::ConsolidatedInvoiceSerializer < BaseSerializer
  delegate :company, :id, :quickbooks_total_fees_amount_in_usd, :invoice_date,
           :integration_external_id, :sync_token, to: :object

  def attributes
    result = {
      TxnDate: invoice_date.iso8601,
      VendorRef: {
        value: quickbooks_integration.flexile_vendor_id,
      },
      Line: [
        {
          Description: "Inv ##{id} - Flexile Fees",
          DetailType: "AccountBasedExpenseLineDetail",
          Amount: quickbooks_total_fees_amount_in_usd,
          AccountBasedExpenseLineDetail: {
            AccountRef: {
              value: quickbooks_integration.flexile_fees_expense_account_id,
            },
          },
        }
      ],
    }
    result[:Id] = integration_external_id if integration_external_id.present?
    result[:SyncToken] = sync_token if sync_token.present?
    result
  end

  private
    def quickbooks_integration
      @_quickbooks_integration ||= company.quickbooks_integration
    end
end
