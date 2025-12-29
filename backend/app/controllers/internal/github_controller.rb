# frozen_string_literal: true

class Internal::GithubController < Internal::BaseController
  before_action :authenticate_user_json!
  after_action :verify_authorized

  # GET /internal/github/oauth_url
  # Returns the GitHub OAuth URL for the current user to connect their account
  def oauth_url
    authorize :github, :connect?

    state = generate_oauth_state
    session[:github_oauth_state] = state

    redirect_uri = params[:redirect_uri] || github_callback_url

    begin
      render json: {
        url: GithubService.oauth_url(state: state, redirect_uri: redirect_uri),
      }
    rescue GithubService::ConfigurationError => e
      render json: { error: "GitHub integration is not configured" }, status: :service_unavailable
    end
  end

  # POST /internal/github/callback
  # Exchanges the OAuth code for an access token and saves GitHub info to user
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

      # Check if another user already has this GitHub UID
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
      render json: { error: e.message }, status: :bad_request
    rescue GithubService::ApiError => e
      render json: { error: e.message }, status: :unprocessable_entity
    end
  end

  # DELETE /internal/github/disconnect
  # Removes GitHub connection from the current user
  def disconnect
    authorize :github, :disconnect?

    Current.user.update!(
      github_uid: nil,
      github_username: nil,
      github_access_token: nil
    )

    head :no_content
  end

  # GET /internal/github/pr
  # Fetches PR details from a GitHub PR URL
  def pr
    authorize :github, :fetch_pr?

    url = params[:url]

    unless GithubService.valid_pr_url?(url)
      render json: { error: "Invalid GitHub PR URL" }, status: :bad_request
      return
    end

    access_token = Current.user.github_access_token
    unless access_token.present?
      render json: { error: "GitHub account not connected" }, status: :unprocessable_entity
      return
    end

    begin
      pr_details = GithubService.fetch_pr_details_from_url(access_token: access_token, url: url)

      if pr_details.nil?
        render json: { error: "Could not parse PR URL" }, status: :bad_request
        return
      end

      render json: { pr: pr_details }
    rescue GithubService::ApiError => e
      render json: { error: e.message }, status: :unprocessable_entity
    end
  end

  private
    def generate_oauth_state
      SecureRandom.hex(32)
    end

    def github_callback_url
      # This should be configured to point to the frontend callback handler
      "#{request.base_url}/github/callback"
    end
end
