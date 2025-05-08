# frozen_string_literal: true

class GithubIntegrationRecord < IntegrationRecord
  store_accessor :json_data, :description, :resource_name, :resource_id, :status, :url

  ISSUE_STATUSES = %w[open closed].freeze
  PULL_REQUEST_STATUSES = %w[open merged closed draft].freeze

  validates :description, presence: true
  validates :resource_name, presence: true, inclusion: {
    in: IntegrationApi::Github::SUPPORTED_RESOURCE_TYPES,
    message: "is not a valid resource",
  }
  validates :resource_id, presence: true
  validates :status, presence: true
  validates :url, presence: true
  validates :status, inclusion: {
    in: ->(record) { record.resource_name == "issues" ? ISSUE_STATUSES : PULL_REQUEST_STATUSES },
    message: "is not a valid status for this resource type",
  }

  def as_json(*)
    {
      id:,
      external_id: integration_external_id,
      description:,
      resource_id:,
      resource_name:,
      status:,
      url:,
    }
  end
end
