# frozen_string_literal: true

FactoryBot.define do
  factory :equity_allocation do
    company_worker
    year { Date.current.year }

    trait :locked do
      locked { true }
    end
  end
end
