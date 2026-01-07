# frozen_string_literal: true

FactoryBot.define do
  factory :document_signature do
    document
    user
    title { "Signer" }

    trait :signed do
      signed_at { Time.current }
    end
  end
end
