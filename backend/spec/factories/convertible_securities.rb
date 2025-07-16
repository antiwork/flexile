# frozen_string_literal: true

FactoryBot.define do
  factory :convertible_security do
    company_investor
    convertible_investment { association :convertible_investment, company: company_investor.company }
    principal_value_in_cents { 1_000_000_00 }
    implied_shares { 25_123 }
    issued_at { 1.year.ago }
    valuation_cap_cents { nil }
    discount_rate_percent { nil }
    interest_rate_percent { nil }
    maturity_date { nil }
    seniority_rank { nil }

    trait :with_valuation_cap do
      valuation_cap_cents { 10_000_000_00 } # $10M cap
    end

    trait :with_discount do
      discount_rate_percent { 20.0 }
    end

    trait :with_interest do
      interest_rate_percent { 8.0 }
      maturity_date { 5.years.from_now.to_date }
    end

    trait :senior do
      seniority_rank { 1 }
    end
  end
end
