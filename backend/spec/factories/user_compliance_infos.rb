# frozen_string_literal: true

FactoryBot.define do
  factory :user_compliance_info do
    association :user, factory: :user, without_compliance_info: true
    tax_id { "000-00-0000" }

    after :build do |info|
      User::NON_TAX_COMPLIANCE_ATTRIBUTES.each do |attr|
        info.public_send("#{attr}=", info.user.public_send(attr)) unless info.public_send(attr).present?
      end
    end

    trait :us_resident do
      country_code { "US" }
      citizenship_country_code { "US" }
      street_address { "123 Main St" }
      city { "San Francisco" }
      state { "CA" }
      zip_code { "94105" }
    end

    trait :non_us_resident do
      country_code { "FR" }
      citizenship_country_code { "FR" }
      street_address { "1st Street" }
      city { "Paris" }
      state { "75C" }
      zip_code { "75001" }
    end

    trait :without_legal_details do
      birth_date { nil }
      street_address { nil }
      city { nil }
      state { nil }
      zip_code { nil }
      tax_id { nil }
    end

    trait :pre_onboarding do
      without_legal_details

      legal_name { nil }
      country_code { nil }
      citizenship_country_code { nil }
    end

    trait :verified do
      tax_id_status { UserComplianceInfo::TAX_ID_STATUS_VERIFIED }
    end

    trait :confirmed do
      tax_information_confirmed_at { Time.current }
    end
  end
end
