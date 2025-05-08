# frozen_string_literal: true

FactoryBot.define do
  factory :payment do
    invoice
    wise_credential
    wise_recipient
    status { Payment::INITIAL }
    processor_uuid { SecureRandom.uuid }
    net_amount_in_cents { invoice.total_amount_in_usd_cents }
  end
end
