# frozen_string_literal: true

class Internal::Companies::GithubController < Internal::Companies::BaseController
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
