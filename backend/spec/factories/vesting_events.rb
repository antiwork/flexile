# frozen_string_literal: true

FactoryBot.define do
  factory :vesting_event do
    association :equity_grant
    vesting_date { DateTime.current }
    vested_shares { 100 }
  end
end
