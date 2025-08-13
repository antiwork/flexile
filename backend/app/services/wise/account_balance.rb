# frozen_string_literal: true

class Wise::AccountBalance
  AMOUNT_KEY = "wise_balance:amount_cents"
  UPDATED_AT_KEY = "wise_balance:updated_at"

  def self.refresh_flexile_balance
    api_response = Wise::PayoutApi.new.get_balances

    # Handle HTTParty::Response objects and HTTP errors
    if api_response.is_a?(HTTParty::Response)
      unless api_response.success?
        Rails.logger.error "API error from get_balances: #{api_response.code} - #{api_response.body}"
        return nil
      end
      api_response = api_response.parsed_response
    end

    # Add validation to ensure api_response is an array
    unless api_response.is_a?(Array)
      Rails.logger.error "Expected array from get_balances, got #{api_response.class}: #{api_response}"
      return nil
    end

    usd_balance_info = api_response.find { |balance| balance["currency"] == "USD" }
    amount = usd_balance_info&.dig("amount", "value")&.to_f

    return nil unless amount

    update_flexile_balance(amount_cents: (amount * 100).to_i)
    amount
  end

  def self.create_usd_balance_if_needed
    api_response = Wise::PayoutApi.new.get_balances

    # Handle HTTParty::Response objects and HTTP errors
    if api_response.is_a?(HTTParty::Response)
      unless api_response.success?
        Rails.logger.error "API error from get_balances: #{api_response.code} - #{api_response.body}"
        return
      end
      api_response = api_response.parsed_response
    end

    # Add validation to ensure api_response is an array
    unless api_response.is_a?(Array)
      Rails.logger.error "Expected array from get_balances, got #{api_response.class}: #{api_response}"
      return
    end

    return if api_response.find { |balance| balance["currency"] == "USD" }.present?

    Wise::PayoutApi.new.create_usd_balance
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
    usd_balance_info = balance_infos.find { _1["currency"] == "USD" }
    api.simulate_top_up_balance(
      balance_id: usd_balance_info["id"],
      currency: usd_balance_info["currency"],
      amount:,
    )
  end
end
