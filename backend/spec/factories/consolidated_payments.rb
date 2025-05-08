# frozen_string_literal: true

FactoryBot.define do
  factory :consolidated_payment do
    consolidated_invoice
    status { ConsolidatedPayment::INITIAL }

    trait :succeeded do
      association :consolidated_invoice, :paid
      status { ConsolidatedPayment::SUCCEEDED }
    end
  end
end
