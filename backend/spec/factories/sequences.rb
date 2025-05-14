# frozen_string_literal: true

FactoryBot.define do
  sequence(:email) { |n| "edgar#{SecureRandom.hex(4)}_#{n}@flexile.com" }
end
