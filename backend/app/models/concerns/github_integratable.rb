# frozen_string_literal: true

module GithubIntegratable
  extend ActiveSupport::Concern

  included do
    has_one :github_integration_record, -> do
      alive.joins(:integration).where(integration: { type: "GithubIntegration" })
    end, as: :integratable, class_name: "GithubIntegrationRecord"

    delegate :integration_external_id, to: :github_integration_record, allow_nil: true
  end
end
