# frozen_string_literal: true

FactoryBot.define do
  factory :equity_grant_exercise_request do
    equity_grant
    equity_grant_exercise

    number_of_options { equity_grant.vested_shares }
    exercise_price_usd { equity_grant.exercise_price_usd }
  end
end
