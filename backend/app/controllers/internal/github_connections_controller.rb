# frozen_string_literal: true

class Internal::GithubConnectionsController < Internal::BaseController
  before_action :authenticate_user_json!, except: :callback
  before_action :authenticate_from_state!, only: :callback

  # POST /internal/github_connection/start
  def start
    unless Current.user.worker?
      render json: { error: "Only workers can connect their GitHub account" }, status: :forbidden
      return
    end

    state = JwtService.generate_oauth_state(user_id: Current.user.id)
    cookies[:github_oauth_state] = state

    # Store requested redirect_url in a cookie if provided
    if params[:redirect_url].present?
      cookies[:github_oauth_redirect_url] = params[:redirect_url]
    end

    # Use the rails route helper to ensure the callback URL is correct
    callback_url = callback_github_connection_url(protocol: PROTOCOL, host: API_DOMAIN)

    github_auth_url = "https://github.com/login/oauth/authorize?" \
                      "client_id=#{ENV['GH_CLIENT_ID']}&" \
                      "redirect_uri=#{CGI.escape(callback_url)}&"  \
                      "state=#{state}&" \
                      "scope=read:user,user:email"

    render json: { url: github_auth_url }, status: :ok
  end

  # GET /internal/github_connection/callback
  def callback
    code = params[:code]
    # Clear the state cookie if it exists (though we rely on signed state now)
    cookies.delete(:github_oauth_state)

    github_uid = nil
    github_username = nil

    if (Rails.env.test? || ENV["GH_CLIENT_ID"].blank?) && code == "mock_code"
      # Mock response for E2E tests
      github_uid = 12345
      github_username = "github_dev_user"
    else
      # Exchange code for token
      token_response = Octokit.exchange_code_for_token(
        code,
        ENV["GH_CLIENT_ID"],
        ENV["GH_CLIENT_SECRET"],
        { redirect_uri: callback_github_connection_url(protocol: PROTOCOL, host: API_DOMAIN) }
      )

      access_token = token_response[:access_token]

      # Fetch user info
      client = Octokit::Client.new(access_token: access_token)
      github_user = client.user
      github_uid = github_user.id
      github_username = github_user.login
    end

    # Update current user with GitHub info
    Current.user.update!(
      github_uid: github_uid,
      github_username: github_username
    )

    # Determine redirect URL
    redirect_url = cookies.delete(:github_oauth_redirect_url) ||
                   "#{PROTOCOL}://#{DOMAIN}/settings/account"

    separator = redirect_url.include?("?") ? "&" : "?"
    redirect_url = "#{redirect_url}#{separator}github=success"

    redirect_to redirect_url, allow_other_host: true
  rescue StandardError => e
    Rails.logger.error("GitHub OAuth error: #{e.message}")
    Rails.logger.error(e.backtrace.join("\n"))

    # Check for Octokit specific info if possible
    if e.respond_to?(:response_body)
      Rails.logger.error("GitHub API Response: #{e.response_body}")
    end

    # On error, redirect back with error param if possible, otherwise render error
    default_error_url = "#{PROTOCOL}://#{DOMAIN}/settings/account"
    redirect_url = cookies.delete(:github_oauth_redirect_url) || default_error_url

    separator = redirect_url.include?("?") ? "&" : "?"
    redirect_url = "#{redirect_url}#{separator}github=error"

    redirect_to redirect_url, allow_other_host: true
  end

  # DELETE /internal/github_connection/disconnect
  def disconnect
    unless Current.user.worker?
      render json: { error: "Only workers can disconnect their GitHub account" }, status: :forbidden
      return
    end

    Current.user.update!(
      github_uid: nil,
      github_username: nil
    )

    render json: { success: true }, status: :ok
  rescue StandardError => e
    Rails.logger.error("GitHub disconnect error: #{e.message}")
    render json: { error: "Failed to disconnect GitHub" }, status: :internal_server_error
  end

  private
    def authenticate_from_state!
      state = params[:state]
      payload = JwtService.decode_oauth_state(state)

      if payload.blank? || payload[:user_id].blank?
        render json: { success: false, error: "Invalid or expired state" }, status: :unauthorized
        return
      end

      user = User.find_by(id: payload[:user_id])
      if user.nil?
        render json: { success: false, error: "User not found" }, status: :unauthorized
        return
      end

      Current.authenticated_user = user
      reset_current
    end
end
