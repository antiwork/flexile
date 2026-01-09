# frozen_string_literal: true

module Internal
  module Companies
    module Administrator
      module Integrations
        class GithubController < BaseController
          def show
            integration = current_company.github_integration
            render json: integration ? integration.configuration : {}
          end

          def create
            integration = current_company.github_integration || current_company.build_github_integration(type: "GithubIntegration", status: "active")
            integration.configuration = { organization: params[:organization] }
            integration.save!
            render json: integration.configuration
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
