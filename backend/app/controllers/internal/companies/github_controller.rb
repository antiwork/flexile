# frozen_string_literal: true

class Internal::Companies::GithubController < Internal::Companies::BaseController
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

  def disconnect
    authorize :github, :manage_org?

    org_name = Current.company.github_org_name
    app_uninstalled = false

    if org_name.present? && GithubService.app_configured?
      installation = GithubService.find_installation_by_account(account_login: org_name)
      if installation.present?
        app_uninstalled = GithubService.delete_installation(installation_id: installation[:id])
      end
    end

    Current.company.update!(
      github_org_name: nil,
      github_org_id: nil,
    )

    render json: {
      success: true,
      app_uninstalled: app_uninstalled,
    }
  end
end
