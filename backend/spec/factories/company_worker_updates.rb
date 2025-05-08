# frozen_string_literal: true

FactoryBot.define do
  factory :company_worker_update do
    company_worker

    period_starts_on { CompanyWorkerUpdatePeriod.new.starts_on }
    period_ends_on { CompanyWorkerUpdatePeriod.new.ends_on }
    published_at { Time.current }

    transient do
      period { nil }
    end

    trait :with_tasks do
      after(:create) do
        create_list(:company_worker_update_task, 2, company_worker_update: _1)
      end
    end

    trait :for_prior_period do
      period { CompanyWorkerUpdatePeriod.new.prev_period }
    end

    after :build do |update, evaluator|
      if evaluator.period.present?
        update.period_starts_on = evaluator.period.starts_on
        update.period_ends_on = evaluator.period.ends_on
      end
    end
  end
end
