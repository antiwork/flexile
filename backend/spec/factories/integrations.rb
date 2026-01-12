# frozen_string_literal: true

FactoryBot.define do
  factory :integration do
    company
    status { "active" }
    configuration { {} }
    account_id { "test-account-id" }

    trait :github do
      type { "GithubIntegration" }
      configuration { { "organization" => "test-org" } }
    end
  end
end
