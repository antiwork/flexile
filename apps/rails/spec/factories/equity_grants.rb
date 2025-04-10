# frozen_string_literal: true

FactoryBot.define do
  factory :equity_grant do
    company_investor
    company_investor_entity do
      association :company_investor_entity,
                  company: company_investor.company,
                  name: company_investor.user.legal_name
    end
    option_pool do
      association :option_pool,
                  company: company_investor.company
    end
    sequence(:name) { |n| "GUM-#{n}" }
    number_of_shares { 100 }
    share_price_usd { 10 }
    exercise_price_usd { 5 }
    vested_shares { number_of_shares }
    unvested_shares { 0 }
    vesting_trigger { :invoice_paid }
    exercised_shares { 0 }
    forfeited_shares { 0 }
    issued_at { Time.current }
    expires_at { issued_at + option_pool.default_option_expiry_months.months }
    accepted_at { DateTime.current }
    option_holder_name { company_investor.user.legal_name }
    board_approval_date { Date.today - 1.day }
    voluntary_termination_exercise_months { 120 }
    involuntary_termination_exercise_months { 120 }
    termination_with_cause_exercise_months { 0 }
    death_exercise_months { 120 }
    disability_exercise_months { 120 }
    retirement_exercise_months { 120 }
    transient do
      year { DateTime.current.year - 2 }
    end
    after(:build) do |grant, evaluator|
      grant.period_started_at ||= DateTime.parse("1 Jan #{evaluator.year}")
      grant.period_ended_at ||= DateTime.parse("31 Dec #{evaluator.year}")
    end

    factory :active_grant do
      number_of_shares { 1000 }
      vested_shares { 100 }
      unvested_shares { 700 }
      exercised_shares { 200 }
      forfeited_shares { 0 }
    end


    trait :vests_on_invoice_payment do
      vested_shares { 0 }
      unvested_shares { number_of_shares }
      vesting_trigger { :invoice_paid }

      after(:create) do |grant|
        grant.build_vesting_events.each(&:save!)
      end
    end

    trait :vests_as_per_schedule do
      vesting_trigger { :scheduled }
      vested_shares { 0 }
      unvested_shares { number_of_shares }
      vesting_schedule
      period_started_at { board_approval_date.beginning_of_day }
      period_ended_at { period_started_at.end_of_day + vesting_schedule.total_vesting_duration_months.months }

      after(:create) do |grant|
        grant.build_vesting_events.each(&:save!)
      end
    end

    # So that virtual attributes are calculated correctly
    after(:create) {  _1.reload }
  end
end
