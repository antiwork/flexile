# frozen_string_literal: true

FactoryBot.define do
  factory :company_update do
    company
    title do
      last_month = 1.month.ago
      "#{last_month.strftime('%B')} #{last_month.year}"
    end
    body { Faker::Lorem.paragraph }
  end
end
