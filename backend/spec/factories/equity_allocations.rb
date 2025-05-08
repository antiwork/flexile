# frozen_string_literal: true

FactoryBot.define do
  factory :equity_allocation do
    company_worker
    year { Date.current.year }
    status { "pending_confirmation" }

    trait :locked do
      locked { true }
      status { "approved" }
    end
  end
end
