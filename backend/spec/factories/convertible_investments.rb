# frozen_string_literal: true

FactoryBot.define do
  factory :convertible_investment do
    sequence(:identifier) { |n| "GUM-SAFE#{n}" }
    entity_name { Faker::Company.name }
    company
    company_valuation_in_dollars { 100_000_000 }
    amount_in_cents { 1_000_000_00 }
    implied_shares { 45_123 }
    valuation_type { "Pre-money" }
    convertible_type { "Crowd SAFE" }
    issued_at { 1.year.ago }
  end
end
