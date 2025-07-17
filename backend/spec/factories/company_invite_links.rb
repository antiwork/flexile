# frozen_string_literal: true

FactoryBot.define do
  factory :company_invite_link do
    association :company
    token { SecureRandom.base58(16) }
    document_template_id { nil }
  end
end
