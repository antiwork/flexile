class WisePayoutFailureJob
  include Sidekiq::Job
  sidekiq_options retry: 3

  def perform(params)
    Rails.logger.info("Processing Wise webhook: #{params}")

    event_type = params.dig("event_type")
    data = params.dig("data")

    is_failure = case event_type
                 when "transfers#payout-failure"
                   true
                 when "transfers#state-change"
                   data.dig("current_state") == "bounced_back"
                 else
                   false
                 end
    return unless is_failure

    transfer_id = event_type == "transfers#payout-failure" ? data.dig("transfer_id") : data.dig("resource", "id")
    return if transfer_id.blank?
    dividend_payment = DividendPayment.wise.find_by(transfer_id: transfer_id.to_s)

    unless dividend_payment
      Rails.logger.warn("WisePayoutFailureJob: Could not find DividendPayment with transfer_id: #{transfer_id}")
      return
    end

    Wise::HandleDividendPayoutFailure.call(dividend_payment, params)
    Rails.logger.info("Successfully processed payout failure for transfer_id: #{transfer_id}")
  end
end