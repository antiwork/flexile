# frozen_string_literal: true

class PayInvoiceJob
  include Sidekiq::Job
  sidekiq_options retry: 0

  def perform(invoice_id)
    invoice = Invoice.find(invoice_id)
    unless invoice.company.is_trusted?
      Rails.logger.info("PayInvoiceJob: Skipping payment for non-trusted company #{invoice.company.id}")
      return
    end
    PayInvoice.new(invoice_id).process
  end
end
