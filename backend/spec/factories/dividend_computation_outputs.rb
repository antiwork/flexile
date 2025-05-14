# frozen_string_literal: true

FactoryBot.define do
  factory :dividend_computation_output do
    dividend_computation
    company_investor
    share_class { "Common" }
    number_of_shares { 123 }
    hurdle_rate { nil }
    original_issue_price_in_usd { nil }
    preferred_dividend_amount_in_usd { 0 }
    qualified_dividend_amount_usd { 0 }
    dividend_amount_in_usd { 1034.12 }
    total_amount_in_usd { 1034.12 }
  end
end
