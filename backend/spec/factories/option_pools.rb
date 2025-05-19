# frozen_string_literal: true

FactoryBot.define do
  factory :option_pool do
    company
    share_class
    name { "Best equity plan" }
    authorized_shares { 100 }
    issued_shares { 50 }

    # So that `available_shares` is loaded correctly
    after(:create) {  _1.reload }
  end
end
