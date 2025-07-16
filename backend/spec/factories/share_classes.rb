# frozen_string_literal: true

FactoryBot.define do
  factory :share_class do
    company
    sequence(:name) { |n| "Common#{n}" }
    original_issue_price_in_dollars { 0.2345 }
    hurdle_rate { 8.37 }
    liquidation_preference_multiple { 1.0 }
    participating { false }
    participation_cap_multiple { nil }
    seniority_rank { nil }

    trait :preferred do
      sequence(:name) { |n| "Series A Preferred#{n}" }
      preferred { true }
      liquidation_preference_multiple { 1.0 }
      participating { false }
      seniority_rank { 1 }
    end

    trait :participating do
      participating { true }
      participation_cap_multiple { 3.0 }
    end

    trait :high_preference do
      liquidation_preference_multiple { 2.0 }
    end
  end
end
