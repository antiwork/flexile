# frozen_string_literal: true

FactoryBot.define do
  factory :company_github_connection do
    company { nil }
    connected_by { nil }
    github_org_id { "MyString" }
    github_org_login { "MyString" }
    revoked_at { "2025-12-28 07:17:57" }
  end
end
