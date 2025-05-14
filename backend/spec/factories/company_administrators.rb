# frozen_string_literal: true

FactoryBot.define do
  factory :company_administrator do
    company
    user

    trait :pre_onboarding do
      association :company, factory: [:company, :pre_onboarding]
    end
  end
end
