# frozen_string_literal: true

FactoryBot.define do
  factory :dividend_computation do
    company
    total_amount_in_usd { 1_000_000 }
    dividends_issuance_date { Time.current }
    return_of_capital { false }
  end
end
