# frozen_string_literal: true

class WiseTransferUpdateJob
  include Sidekiq::Job
  sidekiq_options retry: 5

  def perform(params)
    Rails.logger.info("Processing Wise Transfer webhook: #{params}")

    profile_id = params.dig("data", "resource", "profile_id").to_s
    return if profile_id != WISE_PROFILE_ID && WiseCredential.where(profile_id:).none?

    transfer_id = params.dig("data", "resource", "id")
    return if transfer_id.blank?

    current_state = params.dig("data", "current_state")

    payment = Payment.find_by(wise_transfer_id: transfer_id)
    if payment.nil?
      if (equity_buyback_payment = EquityBuybackPayment.wise.find_by(transfer_id:))
        EquityBuybackPaymentTransferUpdate.new(equity_buyback_payment, params).process
      elsif (dividend_payment = DividendPayment.wise.find_by(transfer_id:))
        DividendPaymentTransferUpdate.new(dividend_payment, params).process
      else
        Rails.logger.info("No payment found for Wise Transfer webhook: #{params}")
      end
      return
    end
    invoice = payment.invoice
    payment.update!(wise_transfer_status: current_state)
    api_service = Wise::PayoutApi.new(wise_credential: payment.wise_credential)

    if payment.in_failed_state?
      unless payment.marked_failed?
        payment.update!(status: Payment::FAILED)
        if payment.is_a?(Payment)
          amount_cents = api_service.get_transfer(transfer_id:)["sourceValue"] * -100
          payment.balance_transactions.create!(company: payment.company, amount_cents:, transaction_type: BalanceTransaction::PAYMENT_FAILED)
        end
      end
      invoice.update!(status: Invoice::FAILED)
    elsif payment.in_processing_state?
      invoice.update!(status: Invoice::PROCESSING)
    elsif current_state == Payments::Wise::OUTGOING_PAYMENT_SENT
      amount = api_service.get_transfer(transfer_id:)["targetValue"]
      estimate = Time.zone.parse(api_service.delivery_estimate(transfer_id:)["estimatedDeliveryDate"])
      payment.update!(status: Payment::SUCCEEDED, wise_transfer_amount: amount, wise_transfer_estimate: estimate)
      invoice.mark_as_paid!(timestamp: Time.zone.parse(params.dig("data", "occurred_at")), payment_id: payment.id)
    end
  end
end
