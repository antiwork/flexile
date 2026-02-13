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
    InvoicePaymentTransferUpdate.new(
      payment,
      current_state:,
      occurred_at: Time.zone.parse(params.dig("data", "occurred_at")),
    ).process
  end
end
