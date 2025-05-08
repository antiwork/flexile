# frozen_string_literal: true

class EquityBuybackPaymentTransferUpdate
  def initialize(equity_buyback_payment, transfer_params)
    @equity_buyback_payment = equity_buyback_payment
    @equity_buybacks = @equity_buyback_payment.equity_buybacks
    @transfer_params = transfer_params
  end

  def process
    transfer_id = transfer_params.dig("data", "resource", "id")
    current_state = transfer_params.dig("data", "current_state")

    equity_buyback_payment.update!(wise_transfer_status: current_state)

    if equity_buyback_payment.in_failed_state?
      equity_buyback_payment.update!(status: Payment::FAILED) unless equity_buyback_payment.marked_failed?
    elsif equity_buyback_payment.in_processing_state?
      equity_buybacks.update!(status: EquityBuyback::PROCESSING)
    elsif current_state == Payments::Wise::OUTGOING_PAYMENT_SENT
      api_service = Wise::PayoutApi.new(wise_credential: equity_buyback_payment.wise_credential)
      amount = api_service.get_transfer(transfer_id:)["targetValue"]
      estimate = Time.zone.parse(api_service.delivery_estimate(transfer_id:)["estimatedDeliveryDate"])
      equity_buyback_payment.update!(status: Payment::SUCCEEDED, transfer_amount: amount,
                                     wise_transfer_estimate: estimate)
      equity_buybacks.each do |equity_buyback|
        equity_buyback.update!(status: EquityBuyback::PAID, paid_at: Time.zone.parse(transfer_params.dig("data", "occurred_at")))
      end
      CompanyInvestorMailer.equity_buyback_payment(equity_buyback_payment_id: equity_buyback_payment.id).deliver_later
    end
  end

  private
    attr_reader :equity_buyback_payment, :transfer_params, :equity_buybacks
end
