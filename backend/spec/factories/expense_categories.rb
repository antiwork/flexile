# frozen_string_literal: true

FactoryBot.define do
  factory :expense_category do
    company
    name { "Travel" }
  end
end
