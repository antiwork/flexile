class WiseRefundJob
  include Sidekiq::Job
  sidekiq_options retry: 3

  def perform(params)
    Rails.logger.info("Processing Wise Refund webhook: #{params}")
    transfer_id = params.dig("data", "resource", "id")
    return if transfer_id.blank?

    dividend_payment = DividendPayment.wise.find_by(transfer_id: transfer_id.to_s)
    return unless dividend_payment

    Wise::HandleDividendPayoutFailure.call(dividend_payment, params)
  end
end