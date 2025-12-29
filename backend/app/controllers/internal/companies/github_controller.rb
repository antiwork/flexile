# frozen_string_literal: true

class Internal::Companies::GithubController < Internal::Companies::BaseController
  # POST /internal/companies/:company_id/github/connect
  # Connects a GitHub organization to the company
  def connect
    authorize :github, :manage_org?

    github_org_name = params[:github_org_name]
    github_org_id = params[:github_org_id]

    if github_org_name.blank?
      render json: { error: "GitHub organization name is required" }, status: :bad_request
      return
    end

    Current.company.update!(
      github_org_name: github_org_name,
      github_org_id: github_org_id
    )

    render json: {
      success: true,
      github_org_name: github_org_name,
    }
  end

  # DELETE /internal/companies/:company_id/github/disconnect
  # Removes GitHub organization connection from the company
  def disconnect
    authorize :github, :manage_org?

    Current.company.update!(
      github_org_name: nil,
      github_org_id: nil
    )

    head :no_content
  end
end
