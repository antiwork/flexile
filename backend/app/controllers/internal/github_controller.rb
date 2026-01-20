# frozen_string_literal: true

class Internal::GithubController < Internal::BaseController
  before_action :authenticate_user_json!, except: [:installation_callback]
  after_action :verify_authorized, except: [:installation_callback]

  def oauth_url
    authorize :github, :connect?

    state = SecureRandom.hex(32)
    session[:github_oauth_state] = state
    redirect_uri = params[:redirect_uri] || github_callback_url

    begin
      render json: { url: GithubService.oauth_url(state: state, redirect_uri: redirect_uri) }
    rescue GithubService::ConfigurationError
      render json: { error: "GitHub integration is not configured" }, status: :service_unavailable
    end
  end

  def app_installation_url
    authorize :github, :manage_org?

    state = GithubService.generate_state_token(user_id: Current.user.id, company_id: Current.company.id)

    url = GithubService.app_installation_url(state: state)
    render json: { url: url }
  rescue GithubService::ConfigurationError
    render json: { error: "GitHub integration is not configured" }, status: :service_unavailable
  end

  def callback
    authorize :github, :connect?

    code = params[:code]
    state = params[:state]
    redirect_uri = params[:redirect_uri] || github_callback_url

    if state.blank? || state != session[:github_oauth_state]
      render json: { error: "Invalid state parameter" }, status: :bad_request
      return
    end

    session.delete(:github_oauth_state)

    begin
      access_token = GithubService.exchange_code_for_token(code: code, redirect_uri: redirect_uri)
      user_info = GithubService.fetch_user_info(access_token: access_token)

      existing_user = User.where(github_uid: user_info[:uid]).where.not(id: Current.user.id).first
      if existing_user.present?
        render json: { error: "This GitHub account is already connected to another user" }, status: :conflict
        return
      end

      Current.user.update!(
        github_uid: user_info[:uid],
        github_username: user_info[:username],
        github_access_token: access_token
      )

      render json: {
        success: true,
        github_username: user_info[:username],
      }
    rescue GithubService::ConfigurationError
      render json: { error: "GitHub integration is not configured" }, status: :service_unavailable
    rescue GithubService::OAuthError => e
      Rails.logger.error "[GitHub OAuth] Authentication failed for user #{Current.user.id}: #{e.message}"
      render json: { error: "GitHub authentication failed. Please try again." }, status: :bad_request
    rescue GithubService::ApiError => e
      Rails.logger.error "[GitHub API] Error fetching user info for user #{Current.user.id}: #{e.message}"
      render json: { error: "Unable to fetch data from GitHub. Please try again." }, status: :unprocessable_entity
    end
  end

  def disconnect
    authorize :github, :disconnect?

    Current.user.update!(
      github_uid: nil,
      github_username: nil,
      github_access_token: nil
    )

    head :no_content
  end

  def pr
    authorize :github, :fetch_pr?

    url = params[:url]

    unless GithubService.valid_pr_url?(url)
      render json: { error: "Invalid GitHub PR URL" }, status: :bad_request
      return
    end

    unless Current.company.github_org_name.present?
      render json: { error: "GitHub App not connected. Please connect GitHub in Settings > Integrations." }, status: :unprocessable_entity
      return
    end

    begin
      pr_details = GithubService.fetch_pr_details_from_url(
        org_name: Current.company.github_org_name,
        url: url
      )

      if pr_details.nil?
        render json: { error: "Could not parse PR URL" }, status: :bad_request
        return
      end

      render json: { pr: pr_details }
    rescue GithubService::ApiError => e
      Rails.logger.error "[GitHub PR] API error fetching PR #{url} for user #{Current.user.id}: #{e.message}"
      render json: { error: "Unable to fetch PR details from GitHub. Please try again." }, status: :unprocessable_entity
    end
  end

  def installation_callback
    return render json: { error: "Missing state parameter" }, status: :bad_request if params[:state].blank?
    return render json: { error: "GitHub App installation was not completed" }, status: :bad_request unless params[:setup_action] == "install" && params[:installation_id].present?
    return render json: { error: "OAuth code not received from GitHub" }, status: :bad_request if params[:code].blank?

    state_params = GithubService.verify_state_token(params[:state], :user_id, :company_id)
    return render json: { error: "Invalid or expired installation link. Please try connecting again." }, status: :bad_request unless state_params

    user = User.find_by(id: state_params[:user_id])
    return render json: { error: "User not found. Please try connecting again." }, status: :not_found unless user

    company = Company.find_by(id: state_params[:company_id])
    return render json: { error: "Company not found or you are not an administrator" }, status: :forbidden unless company && user.company_administrator_for(company).present?

    access_token = GithubService.exchange_code_for_token(
      code: params[:code],
      redirect_uri: github_installation_callback_url
    )
    user_info = GithubService.fetch_user_info(access_token: access_token)

    existing_user = User.where(github_uid: user_info[:uid]).where.not(id: user.id).first
    if existing_user.present?
      return render json: { error: "This GitHub account is already connected to another user" }, status: :conflict
    end

    user.update!(
      github_uid: user_info[:uid],
      github_username: user_info[:username],
      github_access_token: access_token
    )

    installation_info = GithubService.fetch_installation(installation_id: params[:installation_id])
    return render json: { error: "Could not find the GitHub App installation. Please ensure the app is properly installed and try again." }, status: :unprocessable_entity unless installation_info

    account = installation_info[:account]
    company.update!(
      github_org_name: account[:login],
      github_org_id: account[:id]
    )

    Rails.logger.info "[GitHub Installation] Connected #{account[:login]} for user #{user_info[:username]}"

    render json: {
      success: true,
      installation_id: params[:installation_id].to_s,
      company_id: company.external_id,
      auto_connected: true,
      org_name: account[:login],
      github_username: user_info[:username],
      message: "Successfully connected to #{account[:login]}",
    }
  rescue GithubService::OAuthError => e
    Rails.logger.error "[GitHub Installation] OAuth error for user #{state_params&.dig(:user_id)}: #{e.message}"
    render json: { error: "GitHub authentication failed. Please try again." }, status: :bad_request
  rescue GithubService::ApiError => e
    Rails.logger.error "[GitHub Installation] API error for user #{state_params&.dig(:user_id)}: #{e.message}"
    render json: { error: "Unable to fetch data from GitHub. Please try again." }, status: :unprocessable_entity
  rescue StandardError => e
    Rails.logger.error "[GitHub Installation] Unexpected error: #{e.class} - #{e.message}\n#{e.backtrace.first(5).join("\n")}"
    render json: { error: "An unexpected error occurred. Please try again." }, status: :internal_server_error
  end

  private
    def github_callback_url
      "#{request.base_url}/github/callback"
    end

    def github_installation_callback_url
      "#{request.base_url}/github/installation"
    end
end
