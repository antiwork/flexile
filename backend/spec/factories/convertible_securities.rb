# frozen_string_literal: true

FactoryBot.define do
  factory :convertible_security do
    company_investor
    convertible_investment { association :convertible_investment, company: company_investor.company }
    principal_value_in_cents { 1_000_000_00 }
    implied_shares { 25_123 }
    issued_at { 1.year.ago }
  end
end
