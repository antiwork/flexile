# frozen_string_literal: true

FactoryBot.define do
  factory :user_lead do
    email { generate(:email) }
  end
end
