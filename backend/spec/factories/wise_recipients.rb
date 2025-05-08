# frozen_string_literal: true

FactoryBot.define do
  factory :wise_recipient do
    user
    wise_credential

    country_code { "US" }
    currency { "USD" }
    recipient_id { "148563324" } # Test Wise Sandbox Recipient ID
    last_four_digits { "1234" }
    account_holder_name { "Jane Q. Contractor" }
  end
end
