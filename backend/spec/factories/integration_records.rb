# frozen_string_literal: true

FactoryBot.define do
  factory :integration_record do
    association :integration, factory: :quickbooks_integration

    integration_external_id { "1" }
    sync_token { "0" }

    trait :quickbooks_journal_entry do
      quickbooks_journal_entry { true }
    end

    for_user # default to the :for_user trait if none is specified

    trait :for_user do
      association :integratable, factory: :user
    end

    trait :for_invoice do
      association :integratable, factory: :invoice
    end

    trait :for_consolidated_invoice do
      association :integratable, factory: :consolidated_invoice
    end

    trait :for_payment do
      association :integratable, factory: :payment
    end

    trait :for_consolidated_payment do
      association :integratable, factory: :consolidated_payment
    end
  end
end
