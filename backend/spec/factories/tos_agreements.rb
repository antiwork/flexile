# frozen_string_literal: true

FactoryBot.define do
  factory :tos_agreement do
    user
    ip_address { Faker::Internet.ip_v4_address }
  end
end
