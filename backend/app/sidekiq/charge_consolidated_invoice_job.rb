# frozen_string_literal: true

class ChargeConsolidatedInvoiceJob
  include Sidekiq::Job
  sidekiq_options retry: 5

  def perform(consolidated_invoice_id)
    ChargeConsolidatedInvoice.new(consolidated_invoice_id).process
  end
end
