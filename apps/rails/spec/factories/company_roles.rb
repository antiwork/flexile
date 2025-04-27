# frozen_string_literal: true

FactoryBot.define do
  factory :company_role do
    company
    name { Faker::Job.title }
    job_description { Faker::Quote.famous_last_words }
    capitalized_expense { Faker::Number.between(from: 0, to: 80) }

    transient do
      pay_rate_in_subunits { Faker::Number.between(from: 100_00, to: 200_00) }
      pay_rate_type { CompanyRoleRate.pay_rate_types[:hourly] }
    end

    factory :project_based_company_role do
      name { "Project-based Engineer" }
      pay_rate_type { CompanyRoleRate.pay_rate_types[:project_based] }
    end

    factory :salary_company_role do
      name { "Salaried Engineer" }
      pay_rate_type { CompanyRoleRate.pay_rate_types[:salary] }
    end

    after :build do |company_role, evaluator|
      company_role.rate = build(:company_role_rate, pay_rate_in_subunits: evaluator.pay_rate_in_subunits,
                                                    pay_rate_type: evaluator.pay_rate_type,
                                                    company_role: nil)
    end
  end
end
