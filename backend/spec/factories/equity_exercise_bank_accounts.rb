# frozen_string_literal: true

FactoryBot.define do
  factory :equity_exercise_bank_account do
    company
    details do
      [
        ["Beneficiary name", company.name],
        ["Beneficiary address", "548 Market Street, San Francisco, CA 94104"],
        ["Bank name", "Mercury Business"],
        ["Routing number", "987654321"],
        ["SWIFT/BIC", "WZYOPW1L"],
      ]
    end
    account_number { "0123456789" }
  end
end
