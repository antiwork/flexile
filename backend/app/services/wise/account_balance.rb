# frozen_string_literal: true

class Wise::AccountBalance
  AMOUNT_KEY = "wise_balance:amount_cents"
  UPDATED_AT_KEY = "wise_balance:updated_at"

  def self.refresh_flexile_balance
    api_response = Wise::PayoutApi.new.get_balances

    # Handle different response formats gracefully
    return 0 unless api_response.is_a?(Array)

    usd_balance_info = api_response.find { |balance| balance.is_a?(Hash) && balance["currency"] == "USD" }
    amount = usd_balance_info&.dig("amount", "value")&.to_f || 0

    update_flexile_balance(amount_cents: (amount * 100).to_i)
    amount
  rescue => e
    Rails.logger.warn "Failed to refresh Flexile balance: #{e.message}"
    0
  end

  def self.create_usd_balance_if_needed
    api_response = Wise::PayoutApi.new.get_balances

    # Handle different response formats and errors gracefully
    return unless api_response.is_a?(Array)
    return if api_response.find { |balance| balance.is_a?(Hash) && balance["currency"] == "USD" }.present?

    Wise::PayoutApi.new.create_usd_balance
  rescue => e
    Rails.logger.warn "Failed to create USD balance: #{e.message}"
    # Continue without failing the entire seeding process
  end

  def self.update_flexile_balance(amount_cents:)
    $redis.mset(
      AMOUNT_KEY, amount_cents,
      UPDATED_AT_KEY, Time.current.to_i,
    )
  end

  def self.flexile_balance_usd
    $redis.get(AMOUNT_KEY).to_i / 100.0
  end

  def self.has_sufficient_flexile_balance?(usd_amount)
    refresh_flexile_balance
    flexile_balance_usd >= usd_amount + Balance::REQUIRED_BALANCE_BUFFER_IN_USD
  end

  def self.simulate_top_up_usd_balance(amount:)
    api = Wise::PayoutApi.new
    balance_infos = api.get_balances

    # Handle different response formats gracefully
    return unless balance_infos.is_a?(Array)

    usd_balance_info = balance_infos.find { |balance| balance.is_a?(Hash) && balance["currency"] == "USD" }
    return unless usd_balance_info

    api.simulate_top_up_balance(
      balance_id: usd_balance_info["id"],
      currency: usd_balance_info["currency"],
      amount:,
    )
  rescue => e
    Rails.logger.warn "Failed to simulate top up USD balance: #{e.message}"
  end
end
