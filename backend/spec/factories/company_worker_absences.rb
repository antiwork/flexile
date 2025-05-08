# frozen_string_literal: true

FactoryBot.define do
  factory :company_worker_absence do
    company_worker
    starts_on { Date.today }
    ends_on { Date.today + 1.day }
  end
end
