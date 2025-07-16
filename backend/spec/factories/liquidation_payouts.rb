# frozen_string_literal: true

FactoryBot.define do
  factory :liquidation_payout do
    liquidation_scenario
    company_investor
    share_class { "Common Stock" }
    security_type { "equity" }
    number_of_shares { 1_000 }
    payout_amount_cents { 500_000_00 } # $500K
    liquidation_preference_amount { 0.0 }
    participation_amount { 0.0 }
    common_proceeds_amount { 500_000.0 }

    trait :convertible do
      security_type { "convertible" }
      share_class { nil }
      number_of_shares { nil }
    end

    trait :preferred do
      share_class { "Series A Preferred" }
      liquidation_preference_amount { 250_000.0 }
      participation_amount { 100_000.0 }
      common_proceeds_amount { 150_000.0 }
    end

    trait :zero_payout do
      payout_amount_cents { 0 }
      liquidation_preference_amount { 0.0 }
      participation_amount { 0.0 }
      common_proceeds_amount { 0.0 }
    end
  end
end