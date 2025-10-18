# frozen_string_literal: true

class EnqueueInvoicePayment
  def initialize(invoice:)
    @invoice = invoice
  end

  def perform
    invoice.with_lock do
      return unless invoice.immediately_payable?
      return if invoice.status.in?([Invoice::PAYMENT_PENDING, Invoice::PROCESSING])

      invoice.update!(status: Invoice::PAYMENT_PENDING)
      PayInvoiceJob.perform_async(invoice.id)
    end
  end

  private
    attr_reader :invoice
end
