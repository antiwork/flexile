# frozen_string_literal: true

class ConsolidatedInvoicePresenter
  include ActionView::Helpers::TextHelper

  delegate :id, :invoice_number, :company, :period_start_date, :period_end_date, :invoice_date, :created_at, :total_amount_in_usd, :total_fees_in_usd, :status, :total_contractors, :invoices, :receipt, :successful_payment, to: :@consolidated_invoice, allow_nil: true

  def initialize(consolidated_invoice)
    @consolidated_invoice = consolidated_invoice
  end

  def overview_props
    {
      id:,
      created_at: created_at.iso8601,
      invoice_date:,
      total_contractors:,
      total_amount_in_usd:,
      status: status || default_status,
      receipt: receipt.present? ? {
        url: Rails.application.routes.url_helpers.rails_blob_path(receipt, disposition: "attachment"),
      } : nil,
    }
  end

  private
    def default_status
      "pending"
    end
end
