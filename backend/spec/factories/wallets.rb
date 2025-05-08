# frozen_string_literal: true

FactoryBot.define do
  factory :wallet do
    user
    wallet_address { "0x1234f5ea0ba39494ce839613fffba74279579268" }
  end
end
