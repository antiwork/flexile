# frozen_string_literal: true

FactoryBot.define do
  factory :user do
    legal_name { Faker::Name.name }
    email { generate :email }
    password { "-42Q_.c_36@Ca!mW-xTJ8v*" }
    confirmed_at { Time.current }
    invitation_accepted_at { Time.current }

    current_sign_in_ip { Faker::Internet.ip_v4_address }
    last_sign_in_ip    { Faker::Internet.ip_v4_address }
    street_address { "1st Street" }
    city { "New York" }
    state { "NY" }
    country_code { "US" }
    citizenship_country_code { "US" }
    zip_code { "10004" }
    birth_date { Date.new(1980, 7, 15) }

    transient do
      without_bank_account { false }
      without_compliance_info { false }
    end

    after :build do |user|
      user.preferred_name ||= user.legal_name.split.first if user.legal_name?
    end

    after :create do |user, evaluator|
      create(:wise_recipient, user:) unless evaluator.without_bank_account
      create(:user_compliance_info, :confirmed, user:) unless evaluator.without_compliance_info
    end

    trait :without_compliance_info do
      without_compliance_info { true }
    end

    trait :without_legal_details do
      without_compliance_info

      street_address { nil }
      city { nil }
      state { nil }
      zip_code { nil }
      without_bank_account { true }
      birth_date { nil }
    end

    trait :pre_onboarding do
      without_legal_details
      without_bank_account { true }
      preferred_name { nil }
      legal_name { nil }
      country_code { nil }
      citizenship_country_code { nil }

      after :create do |user|
        create(:user_compliance_info, :pre_onboarding, user:)
      end
    end

    trait :contractor do
      after :create do |user|
        create(:company_worker, user:)
      end
    end

    trait :company_admin do
      after :create do |user|
        create(:company_administrator, user:)
      end
    end

    trait :investor do
      after :create do |user|
        create(:company_investor, user:)
      end
    end

    trait :company_lawyer do
      after :create do |user|
        create(:company_lawyer, user:)
      end
    end
  end
end
