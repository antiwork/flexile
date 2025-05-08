# frozen_string_literal: true

class Internal::Companies::Administrator::GithubController < Internal::Companies::BaseController
  before_action :load_github_api_client, only: [:create, :destroy]
  before_action :load_github_integration, only: [:destroy]


  def create
    authorize GithubIntegration

    if @github_api_client.valid_oauth_state?(params[:state])
      response = @github_api_client.get_oauth_token(params[:code])

      if response.success?
        token = response.parsed_response["access_token"]
        account_id = @github_api_client.fetch_account_id(token)
        integration = GithubIntegration.find_or_initialize_by(account_id:, company: Current.company)
        integration.organizations = @github_api_client.fetch_organizations(token)

        if integration.persisted? && integration.deleted?
          integration.deleted_at = nil

          if integration.integration_records.deleted.exists?
            integration.integration_records.deleted.each(&:mark_undeleted!)
          end
        end

        integration.status = GithubIntegration.statuses[:active]
        integration.update_tokens!(response)

        render json: {
          success: true,
          integration: integration.as_json,
        }
      else
        render json: { success: false }, status: :unprocessable_entity
      end
    else
      render json: { success: false }, status: :unprocessable_entity
    end
  end

  def destroy
    authorize @github_integration

    response = @github_api_client.revoke_token

    if response.success?
      @github_integration.mark_deleted!

      render json: { success: true }
    else
      render json: { success: false }, status: :unprocessable_entity
    end
  end

  private
    def load_github_api_client
      @github_api_client = IntegrationApi::Github.new(company_id: Current.company.id)
    end

    def load_github_integration
      @github_integration = Current.company.github_integration
      e404 unless @github_integration
    end
end
