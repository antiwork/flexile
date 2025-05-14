# frozen_string_literal: true

FactoryBot.define do
  factory :company_investor_entity do
    company
    name { Faker::Name.name }
    email { Faker::Internet.email }
    investment_amount_cents { 0 }
  end
end
