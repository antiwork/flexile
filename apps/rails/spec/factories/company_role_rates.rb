# frozen_string_literal: true

FactoryBot.define do
  factory :company_role_rate do
    company_role
    pay_rate_in_subunits { Faker::Number.between(from: 100_00, to: 200_00) }
    pay_rate_type { CompanyRoleRate.pay_rate_types[:hourly] }
  end
end
