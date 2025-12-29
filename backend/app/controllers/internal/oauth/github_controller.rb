# frozen_string_literal: true

class Internal::Oauth::GithubController < Internal::BaseController
  include UserDataSerialization, JwtAuthenticatable, ApiTokenAuthenticatable

  skip_before_action :verify_authenticity_token

  def authorize
    state = SecureRandom.hex(16)
    session[:oauth_state] = state

    client_id = ENV.fetch("GITHUB_CLIENT_ID")
    scope = params[:scope] == "company" ? "read:org" : "read:user"
    redirect_uri = "#{request.base_url}/internal/oauth/github/callback"

    url = "https://github.com/login/oauth/authorize?client_id=#{client_id}&redirect_uri=#{CGI.escape(redirect_uri)}&scope=#{scope}&state=#{state}"
    render json: { url: url }
  end

  def callback
    return render json: { error: "Invalid state" }, status: :bad_request unless valid_state?

    code = params[:code]
    return render json: { error: "No code provided" }, status: :bad_request unless code

    token_response = exchange_code_for_token(code)
    return render json: { error: "Failed to get access token" }, status: :bad_request unless token_response

    access_token = token_response["access_token"]
    github_service = GithubService.new(access_token)

    if params[:scope] == "company"
      # Company GitHub organization setup
      org_data = github_service.fetch_user # This should be organization data, but for now using user
      return render json: { error: "Failed to fetch organization data" }, status: :bad_request unless org_data

      company = current_user.companies.first
      return render json: { error: "No company found" }, status: :bad_request unless company

      company.update!(github_organization: org_data["login"])
      render json: { success: true, organization: org_data["login"] }
    else
      # User GitHub connection
      user_data = github_service.fetch_user
      return render json: { error: "Failed to fetch user data" }, status: :bad_request unless user_data

      # Check if user already has a connection
      connection = current_user.github_connection
      if connection
        connection.update!(
          github_username: user_data["login"],
          github_id: user_data["id"].to_s,
          access_token: access_token
        )
      else
        UserGithubConnection.create!(
          user: current_user,
          github_username: user_data["login"],
          github_id: user_data["id"].to_s,
          access_token: access_token
        )
      end

      success_response_with_jwt(current_user)
    end
  end

  def disconnect
    if params[:scope] == "company"
      company = current_user.companies_as_admin.first
      company&.update!(github_organization: nil)
      render json: { success: true }
    else
      current_user.github_connection&.destroy
      render json: { success: true }
    end
  end

  private

  def valid_state?
    params[:state] == session.delete(:oauth_state)
  end

  def exchange_code_for_token(code)
    client_id = ENV.fetch("GITHUB_CLIENT_ID")
    client_secret = ENV.fetch("GITHUB_CLIENT_SECRET")

    uri = URI("https://github.com/login/oauth/access_token")
    http = Net::HTTP.new(uri.host, uri.port)
    http.use_ssl = true

    request = Net::HTTP::Post.new(uri)
    request["Accept"] = "application/json"
    request.set_form_data(
      client_id: client_id,
      client_secret: client_secret,
      code: code
    )

    response = http.request(request)
    return nil unless response.is_a?(Net::HTTPSuccess)

    JSON.parse(response.body)
  rescue JSON::ParserError
    nil
  end
end