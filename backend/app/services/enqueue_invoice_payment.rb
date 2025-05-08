# frozen_string_literal: true

class EnqueueInvoicePayment
  def initialize(invoice:)
    @invoice = invoice
  end

  def perform
    invoice.with_lock do
      return unless invoice.immediately_payable?

      invoice.update!(status: Invoice::PAYMENT_PENDING)
      PayInvoiceJob.perform_async(invoice.id)
    end
  end

  private
    attr_reader :invoice
end
