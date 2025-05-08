# frozen_string_literal: true

FactoryBot.define do
  factory :dividend_round do
    company
    issued_at { 1.day.ago }
    number_of_shares { 100 }
    number_of_shareholders { 10 }
    total_amount_in_cents { 230_01 }
    status { "Issued" }
    return_of_capital { false }
  end
end
