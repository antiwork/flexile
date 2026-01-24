# frozen_string_literal: true

FactoryBot.define do
  factory :company_github_connection do
    association :company
    association :connected_by, factory: :user
    github_org_id { "12345" }
    github_org_login { "test-org" }
    installation_id { "67890" }
    revoked_at { nil }
  end
end
