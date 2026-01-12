# frozen_string_literal: true

module Internal
  module Companies
    module Administrator
      module Integrations
        class GithubController < BaseController
          def show
            integration = current_company.github_integration
            if integration
              render json: {
                id: integration.id,
                status: integration.status,
                organization: integration.configuration["organization"],
              }
            else
              render json: nil
            end
          end

          def create
            integration = current_company.github_integration || current_company.build_github_integration(type: "GithubIntegration", status: "active")
            integration.configuration = { organization: params[:organization] }
            integration.save!
            render json: {
              id: integration.id,
              status: integration.status,
              organization: integration.configuration["organization"],
            }
          end

          def destroy
            integration = current_company.github_integration
            integration&.destroy!
            head :no_content
          end
        end
      end
    end
  end
end
