# frozen_string_literal: true

class BlackScholesCalculator
  DEFAULT_RISK_FREE_RATE = 0.0358
  DEFAULT_VOLATILITY = 0.70

  def self.calculate_option_value(current_price:, exercise_price:, expiration_date:, risk_free_rate: DEFAULT_RISK_FREE_RATE, volatility: DEFAULT_VOLATILITY)
    time_to_expiration_years = (expiration_date.to_date - Date.current).to_i / 365.25
    return 0.0 if time_to_expiration_years <= 0.0

    d1 = (Math.log(current_price / exercise_price) + (risk_free_rate + 0.5 * volatility**2) * time_to_expiration_years) / (volatility * Math.sqrt(time_to_expiration_years))
    d2 = d1 - (volatility * Math.sqrt(time_to_expiration_years))

    call_value = current_price * normal_cdf(d1) - exercise_price * Math.exp(-risk_free_rate * time_to_expiration_years) * normal_cdf(d2)

    [call_value, 0.0].max
  end

  private
    def self.normal_cdf(x)
      0.5 * (1 + Math.erf(x / Math.sqrt(2)))
    end
end
