# frozen_string_literal: true

class GithubIntegration < Integration
  store_accessor :configuration, :organizations, :webhooks

  validates :organizations, presence: true

  after_create_commit :create_webhooks!
  after_update_commit :delete_webhooks!, if: -> { saved_change_to_status? && deleted? }

  private
    def create_webhooks!
      IntegrationApi::Github.new(company_id:).create_webhooks!
    end

    def delete_webhooks!
      IntegrationApi::Github.new(company_id:).delete_webhooks!
    end
end
