# frozen_string_literal: true

class Quickbooks::ConsolidatedPaymentSerializer < BaseSerializer
  delegate :integration_external_id, :sync_token, to: :object

  def attributes
    result = {
      Line: [
        {
          Amount: consolidated_invoice.quickbooks_total_fees_amount_in_usd,
          LinkedTxn: [
            TxnId: consolidated_invoice.integration_external_id,
            TxnType: "Bill",
          ],
        }
      ],
      TotalAmt: consolidated_invoice.quickbooks_total_fees_amount_in_usd,
      PayType: "Check",
      CheckPayment: {
        BankAccountRef: {
          value: quickbooks_integration.flexile_clearance_bank_account_id,
        },
      },
      VendorRef: {
        value: quickbooks_integration.flexile_vendor_id,
      },
    }
    result[:Id] = integration_external_id if integration_external_id.present?
    result[:SyncToken] = sync_token if sync_token.present?
    result
  end

  private
    def consolidated_invoice
      @_invoice ||= object.consolidated_invoice
    end

    def quickbooks_integration
      @_quickbooks_integration ||= object.company.quickbooks_integration
    end
end
