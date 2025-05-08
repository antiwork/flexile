# frozen_string_literal: true

FactoryBot.define do
  factory :invoice_line_item do
    invoice
    description { Faker::Lorem.sentence }
    minutes { 60 }
    pay_rate_in_subunits { 60_00 }
    total_amount_cents { 60_00 }
  end
end
