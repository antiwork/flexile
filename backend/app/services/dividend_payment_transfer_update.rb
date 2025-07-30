# frozen_string_literal: true

class DividendPaymentTransferUpdate
  def initialize(dividend_payment, transfer_params)
    @dividend_payment = dividend_payment
    @dividends = @dividend_payment.dividends
    @transfer_params = transfer_params
  end

  def process
    transfer_id = transfer_params.dig("data", "resource", "id")
    current_state = transfer_params.dig("data", "current_state")

    dividend_payment.update!(wise_transfer_status: current_state)

    if current_state == Payments::Wise::FUNDS_REFUNDED
      Rails.logger.info("Processing payout failure for transfer_id: #{transfer_id} due to funds_refunded state.")
      dividend_payment.update!(status: Payment::FAILED)
      dividends.update!(status: Dividend::ISSUED, paid_at: nil)
      user = dividends.first&.company_investor&.user
      user.bank_account_for_dividends&.mark_deleted!
      CompanyInvestorMailer.dividend_payment_failed(user, dividend_payment).deliver_later
    elsif dividend_payment.in_failed_state?
      dividend_payment.update!(status: Payment::FAILED) unless dividend_payment.marked_failed?
    elsif dividend_payment.in_processing_state?
      dividends.update!(status: Dividend::PROCESSING)
    elsif current_state == Payments::Wise::OUTGOING_PAYMENT_SENT
      api_service = Wise::PayoutApi.new(wise_credential: dividend_payment.wise_credential)
      amount = api_service.get_transfer(transfer_id:)["targetValue"]
      estimate = Time.zone.parse(api_service.delivery_estimate(transfer_id:)["estimatedDeliveryDate"])
      dividend_payment.update!(status: Payment::SUCCEEDED, transfer_amount: amount,
                               wise_transfer_estimate: estimate)
      dividends.each do |dividend|
        dividend.update!(status: Dividend::PAID, paid_at: Time.zone.parse(transfer_params.dig("data", "occurred_at")))
      end
      CompanyInvestorMailer.dividend_payment(dividend_payment.id).deliver_later
    end
  end

  private
    attr_reader :dividend_payment, :transfer_params, :dividends
end
