# frozen_string_literal: true

FactoryBot.define do
  factory :wise_credential do
    profile_id { WISE_PROFILE_ID }
    api_key { WISE_API_KEY }
  end
end
