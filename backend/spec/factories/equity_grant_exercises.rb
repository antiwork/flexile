# frozen_string_literal: true

FactoryBot.define do
  factory :equity_grant_exercise do
    company_investor
    company { company_investor.company }
    requested_at { Time.current }
    number_of_options { 100 }
    total_cost_cents { 500_00 }
    status { EquityGrantExercise::PENDING }
    contract { Rack::Test::UploadedFile.new(Rails.root.join("spec/fixtures/files/sample.pdf"), "application/pdf") }
    bank_reference { "ACME-#{Time.current.to_i}" }

    transient do
      equity_grants { nil }
    end

    after(:build) do |exercise, evaluator|
      equity_grants = if evaluator.equity_grants.present?
        evaluator.equity_grants
      else
        [build(:equity_grant, company_investor: exercise.company_investor,
                              number_of_shares: exercise.number_of_options,
                              exercise_price_usd: (exercise.total_cost_cents.to_f / exercise.number_of_options / 100).round(2))]
      end
      total_number_of_options = 0
      total_cost_usd = 0

      equity_grants.each do |equity_grant|
        if exercise.equity_grant_exercise_requests.where(equity_grant:).none?
          exercise.equity_grant_exercise_requests.build(
            equity_grant:,
            number_of_options: equity_grant.vested_shares,
            exercise_price_usd: equity_grant.exercise_price_usd,
          )
        end
        total_number_of_options += equity_grant.vested_shares
        total_cost_usd += equity_grant.exercise_price_usd * equity_grant.vested_shares
      end

      exercise.number_of_options ||= total_number_of_options
      exercise.total_cost_cents ||= (total_cost_usd * 100).round
    end

    trait :signed do
      status { EquityGrantExercise::SIGNED }
      signed_at { Time.current }
    end
  end
end
