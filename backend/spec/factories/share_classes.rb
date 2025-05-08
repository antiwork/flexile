# frozen_string_literal: true

FactoryBot.define do
  factory :share_class do
    company
    sequence(:name) { |n| "Common#{n}" }
    original_issue_price_in_dollars { 0.2345 }
    hurdle_rate { 8.37 }
  end
end
