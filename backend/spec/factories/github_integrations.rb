# frozen_string_literal: true

FactoryBot.define do
  factory :github_integration, parent: :integration, class: "GithubIntegration" do
    type { "GithubIntegration" }
    account_id { "1855287" }
    configuration do
      {
        access_token: "gho_aGogSNKXswlREuTd3NLISAMPLE",
        organizations: ["antiwork"],
        webhooks: [{ id: "1234567890", organization: "antiwork" }],
      }
    end
  end
end
