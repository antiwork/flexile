# frozen_string_literal: true

class WiseBalanceWebhookJob
  include Sidekiq::Job
  sidekiq_options retry: 5

  def perform(params)
    Rails.logger.info("Processing Wise Balance webhook: #{params}")

    profile_id = params.dig("data", "resource", "profile_id").to_s
    return unless profile_id == WiseCredential.flexile_credential.profile_id

    currency = params.dig("data", "currency")
    return if currency != "USD"

    balance = params.dig("data", "post_transaction_balance_amount")
    Wise::AccountBalance.update_flexile_balance(amount_cents: (balance * 100).to_i)
  end
end
