# frozen_string_literal: true

FactoryBot.define do
  factory :company_worker_update_task do
    company_worker_update
    name { Faker::Job.field }
    sequence(:position)

    trait :completed do
      completed_at { Time.current }
    end
  end
end
