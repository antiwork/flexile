# frozen_string_literal: true

FactoryBot.define do
  factory :github_integration do
    company

    organization_name { "Antiwork" }
    organization_id { Faker::Number.number(digits: 8) }
    status { GithubIntegration::ACTIVE }
    access_token { "gho_#{SecureRandom.hex(20)}" }

    trait :disconnected do
      status { GithubIntegration::DISCONNECTED }
      deleted_at { Time.current }
    end

    trait :with_installation do
      installation_id { Faker::Number.number(digits: 8) }
    end

    trait :with_refresh_token do
      refresh_token { "ghr_#{SecureRandom.hex(20)}" }
      access_token_expires_at { 8.hours.from_now }
    end

    trait :expired_token do
      access_token_expires_at { 1.hour.ago }
    end
  end
end
