# frozen_string_literal: true

FactoryBot.define do
  factory :company_worker do
    company
    user
    company_role { association :company_role, company: instance.company }

    started_at { Date.today }
    hours_per_week { 40 }
    pay_rate_in_subunits { 60_00 }
    pay_rate_type { CompanyWorker.pay_rate_types[:hourly] }

    trait :inactive do
      ended_at { 1.day.ago }
    end

    trait :hourly do
      hours_per_week { 40 }
      pay_rate_in_subunits { 60_00 }
      pay_rate_type { CompanyWorker.pay_rate_types[:hourly] }
    end

    trait :project_based do
      association :company_role, factory: :project_based_company_role
      hours_per_week { nil }
      pay_rate_in_subunits { 1_000_00 }
      pay_rate_type { CompanyWorker.pay_rate_types[:project_based] }
    end

    transient do
      without_contract { false }
      with_unsigned_contract { false }
      equity_percentage { nil }
    end

    after :create do |company_worker, evaluator|
      unless evaluator.without_contract
        create(:document, company: company_worker.company, signed: !evaluator.with_unsigned_contract, signatories: [company_worker.user])
      end

      if evaluator.equity_percentage
        create(:equity_allocation, company_worker:, equity_percentage: evaluator.equity_percentage, status: "approved")
      end
    end
  end
end
