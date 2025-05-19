# frozen_string_literal: true

FactoryBot.define do
  factory :vesting_schedule do
    total_vesting_duration_months { 48 }
    vesting_frequency_months { 1 }
    cliff_duration_months { 12 }

    trait :four_year_with_one_year_cliff do
      total_vesting_duration_months { 48 }
      vesting_frequency_months { 1 }
      cliff_duration_months { 12 }
    end

    trait :four_year_without_cliff do
      total_vesting_duration_months { 48 }
      vesting_frequency_months { 1 }
      cliff_duration_months { 0 }
    end
  end
end
