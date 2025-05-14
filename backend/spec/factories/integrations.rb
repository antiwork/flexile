# frozen_string_literal: true

FactoryBot.define do
  factory :integration do
    company
    account_id { "1234567890" }
    type { "GenericIntegration" }
    status { Integration.statuses[:initialized] }
    configuration do
      {
        access_token: "token",
      }
    end

    trait :active do
      status { Integration.statuses[:active] }
      last_sync_at { Time.current }
    end

    trait :out_of_sync do
      status { Integration.statuses[:out_of_sync] }
      sync_error { "error" }
    end

    trait :deleted do
      status { Integration.statuses[:deleted] }
      deleted_at { Time.current }
    end
  end
end
