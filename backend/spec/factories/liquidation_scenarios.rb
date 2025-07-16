# frozen_string_literal: true

FactoryBot.define do
  factory :liquidation_scenario do
    company
    name { "Exit Scenario #{SecureRandom.hex(4)}" }
    description { "Hypothetical exit scenario for testing" }
    exit_amount_cents { 100_000_000_00 } # $100M
    exit_date { 1.year.from_now.to_date }
    status { "draft" }

    trait :final do
      status { "final" }
    end

    trait :small_exit do
      exit_amount_cents { 10_000_000_00 } # $10M
    end

    trait :large_exit do
      exit_amount_cents { 1_000_000_000_00 } # $1B
    end
  end
end