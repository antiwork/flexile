# frozen_string_literal: true

class WiseTransferUpdateJob
  include Sidekiq::Job
  sidekiq_options retry: 5

  def perform(params)
    Rails.logger.info("Processing Wise Transfer webhook: #{params}")

    profile_id = params.dig("data", "resource", "profile_id").to_s
    return if profile_id != WISE_PROFILE_ID && WiseCredential.where(profile_id:).none?

    if params["event_type"] == "transfers#refund"
      handle_refund(params)
    else
      handle_state_change(params)
    end
  end

  private

  def handle_refund(params)
    transfer_id = params.dig("data", "resource", "transferId")
    return if transfer_id.blank?

    payment = find_payment(transfer_id)
    return unless payment

    payment.update!(status: Payment::FAILED) if payment.status != Payment::FAILED

    if payment.is_a?(Payment)
      payment.invoice.update!(status: Invoice::FAILED)
      # Use amount from refund payload
      amount_cents = params.dig("data", "resource", "amount") * -100
      payment.balance_transactions.create!(company: payment.company, amount_cents: amount_cents, transaction_type: BalanceTransaction::PAYMENT_FAILED)
    elsif payment.is_a?(EquityBuybackPayment)
      EquityBuybackPaymentTransferUpdate.new(payment, params).process
    elsif payment.is_a?(DividendPayment)
      DividendPaymentTransferUpdate.new(payment, params).process
    end
  end

  def handle_state_change(params)
    transfer_id = params.dig("data", "resource", "id")
    return if transfer_id.blank?

    payment = find_payment(transfer_id)
    return unless payment

    current_state = params.dig("data", "current_state")

    if payment.is_a?(Payment)
      payment.update!(wise_transfer_status: current_state)
    end

    if payment.in_failed_state?
      process_failed_payment(payment, params)
    elsif payment.in_processing_state?
      process_processing_payment(payment, params)
    elsif current_state == Payments::Wise::OUTGOING_PAYMENT_SENT
      process_succeeded_payment(payment, params)
    end
  end

  def find_payment(transfer_id)
    Payment.find_by(wise_transfer_id: transfer_id) ||
      EquityBuybackPayment.wise.find_by(transfer_id: transfer_id) ||
      DividendPayment.wise.find_by(transfer_id: transfer_id)
  end

  def process_failed_payment(payment, params)
    payment.update!(status: Payment::FAILED) if payment.status != Payment::FAILED

    if payment.is_a?(Payment)
      payment.invoice.update!(status: Invoice::FAILED)
      api_service = Wise::PayoutApi.new(wise_credential: payment.wise_credential)
      amount_cents = api_service.get_transfer(transfer_id: payment.wise_transfer_id)["sourceValue"] * -100
      payment.balance_transactions.create!(company: payment.company, amount_cents: amount_cents, transaction_type: BalanceTransaction::PAYMENT_FAILED)
    elsif payment.is_a?(EquityBuybackPayment)
      EquityBuybackPaymentTransferUpdate.new(payment, params).process
    elsif payment.is_a?(DividendPayment)
      DividendPaymentTransferUpdate.new(payment, params).process
    end
  end

  def process_processing_payment(payment, params)
    if payment.is_a?(Payment)
      payment.invoice.update!(status: Invoice::PROCESSING)
    elsif payment.is_a?(DividendPayment)
      DividendPaymentTransferUpdate.new(payment, params).process
    elsif payment.is_a?(EquityBuybackPayment)
      EquityBuybackPaymentTransferUpdate.new(payment, params).process
    end
  end

  def process_succeeded_payment(payment, params)
    if payment.is_a?(Payment)
      api_service = Wise::PayoutApi.new(wise_credential: payment.wise_credential)
      amount = api_service.get_transfer(transfer_id: payment.wise_transfer_id)["targetValue"]
      estimate = Time.zone.parse(api_service.delivery_estimate(transfer_id: payment.wise_transfer_id)["estimatedDeliveryDate"])
      payment.update!(status: Payment::SUCCEEDED, wise_transfer_amount: amount, wise_transfer_estimate: estimate)
      payment.invoice.mark_as_paid!(timestamp: Time.zone.parse(params.dig("data", "occurred_at")), payment_id: payment.id)
    elsif payment.is_a?(DividendPayment)
      DividendPaymentTransferUpdate.new(payment, params).process
    elsif payment.is_a?(EquityBuybackPayment)
      EquityBuybackPaymentTransferUpdate.new(payment, params).process
    end
  end
end