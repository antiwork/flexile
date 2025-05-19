# frozen_string_literal: true

FactoryBot.define do
  factory :company_investor do
    user
    company
    investment_amount_in_cents { 0 }
  end
end
