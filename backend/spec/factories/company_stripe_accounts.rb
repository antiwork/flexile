# frozen_string_literal: true

FactoryBot.define do
  factory :company_stripe_account do
    company

    status { "ready" }
    setup_intent_id { "seti_1LS2aCFSsGLfTpetJF5ZbTzr" }
    bank_account_last_four { "4242" }

    trait :initial do
      status { "initial" }
      bank_account_last_four { nil }
    end

    trait :action_required do
      status { "action_required" }
    end
  end
end
