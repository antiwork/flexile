# frozen_string_literal: true

class InvoicePaymentTransferUpdate
  def initialize(payment, current_state: nil, occurred_at: Time.current)
    @payment = payment
    @invoice = payment.invoice
    @current_state = current_state
    @occurred_at = occurred_at
  end

  def process
    @current_state ||= fetch_transfer["status"]

    return if current_state == payment.wise_transfer_status

    payment.update!(wise_transfer_status: current_state)

    if payment.in_failed_state?
      unless payment.marked_failed?
        payment.update!(status: Payment::FAILED)
        amount_cents = fetch_transfer["sourceValue"] * -100
        payment.balance_transactions.create!(company: payment.company, amount_cents:, transaction_type: BalanceTransaction::PAYMENT_FAILED)
      end
      invoice.update!(status: Invoice::FAILED)
    elsif payment.in_processing_state?
      invoice.update!(status: Invoice::PROCESSING)
    elsif current_state == Payments::Wise::OUTGOING_PAYMENT_SENT
      amount = fetch_transfer["targetValue"]
      estimate = Time.zone.parse(api_service.delivery_estimate(transfer_id: payment.wise_transfer_id)["estimatedDeliveryDate"])
      payment.update!(status: Payment::SUCCEEDED, wise_transfer_amount: amount, wise_transfer_estimate: estimate)
      invoice.mark_as_paid!(timestamp: occurred_at, payment_id: payment.id)
    end
  end

  private
    attr_reader :payment, :invoice, :current_state, :occurred_at

    def api_service
      @api_service ||= Wise::PayoutApi.new(wise_credential: payment.wise_credential)
    end

    def fetch_transfer
      @fetch_transfer ||= api_service.get_transfer(transfer_id: payment.wise_transfer_id)
    end
end
