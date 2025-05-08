# frozen_string_literal: true

class PayInvoiceJob
  include Sidekiq::Job
  sidekiq_options retry: 0

  def perform(invoice_id)
    PayInvoice.new(invoice_id).process
  end
end
