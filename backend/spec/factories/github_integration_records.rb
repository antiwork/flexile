# frozen_string_literal: true

FactoryBot.define do
  factory :github_integration_record do
    association :integration, factory: :github_integration

    integration_external_id { "1" }
    json_data do
      {
        description: "Test Task",
        resource_id: "1",
        resource_name: "pulls",
        status: "open",
        url: "https://github.com/test/task",
      }
    end

    for_task # default to the :for_task trait if none is specified

    trait :for_task do
      association :integratable, factory: :company_worker_update_task
    end
  end
end
