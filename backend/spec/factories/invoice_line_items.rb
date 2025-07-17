# frozen_string_literal: true

FactoryBot.define do
  factory :invoice_line_item do
    invoice
    description { Faker::Lorem.sentence }
    quantity { 1 }
    pay_rate_in_subunits { 60_00 }

    trait :with_float_quantity do
      quantity { 2.5 }
    end
  end
end
