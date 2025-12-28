# frozen_string_literal: true

require "net/http"
require "json"

class Internal::GithubController < Internal::BaseController
  # Initiate GitHub OAuth connection - return OAuth URL for popup flow
  def connect
    oauth_url = build_oauth_url
    render json: { oauth_url: oauth_url }
  end

  # Handle GitHub OAuth callback
  def callback
    code = params[:code]

    unless code.present?
      render json: { error: "Authorization code required" }, status: :bad_request
      return
    end

    # Exchange code for access token
    token_data = exchange_code_for_token(code)

    unless token_data && token_data["access_token"]
      render json: { error: "Failed to exchange authorization code" }, status: :unprocessable_entity
      return
    end

    # Fetch user info from GitHub
    user_info = fetch_github_user(token_data["access_token"])

    unless user_info
      render json: { error: "Failed to fetch GitHub user info" }, status: :unprocessable_entity
      return
    end

    # Update current user with GitHub info
    Current.user.update!(
      github_uid: user_info["id"].to_s,
      github_username: user_info["login"],
      github_access_token: token_data["access_token"]
    )

    render json: {
      success: true,
      github_username: user_info["login"]
    }
  end

  # Disconnect GitHub account
  def disconnect
    Current.user.update!(
      github_uid: nil,
      github_username: nil,
      github_access_token: nil
    )

    render json: { success: true }
  end

  # Fetch PR details for a given URL
  def fetch_pr
    parsed = GithubService.parse_pr_url(params[:url])

    unless parsed
      render json: { error: "Invalid GitHub PR URL" }, status: :bad_request
      return
    end

    service = GithubService.new(access_token: Current.user&.github_access_token)
    pr_data = service.fetch_pr(owner: parsed[:owner], repo: parsed[:repo], number: parsed[:number])

    unless pr_data
      render json: { error: "Could not fetch PR details" }, status: :not_found
      return
    end

    # If PR has no bounty, try to get from linked issue
    if pr_data[:bounty_cents].nil? && parsed[:type] == :pr
      issue_data = service.fetch_issue(owner: parsed[:owner], repo: parsed[:repo], number: parsed[:number])
      pr_data[:bounty_cents] = issue_data[:bounty_cents] if issue_data
    end

    # Check if PR has already been paid
    pr_data[:already_paid] = service.pr_already_paid?(params[:url])

    # Check if PR belongs to a connected company org
    pr_data[:belongs_to_company_org] = belongs_to_company_org?(parsed[:owner])

    # Check if user needs to connect GitHub
    pr_data[:user_github_connected] = Current.user&.github_uid.present?

    # Verify if current user authored the PR
    if Current.user&.github_username.present?
      pr_data[:verified] = pr_data[:author]&.downcase == Current.user.github_username.downcase
    else
      pr_data[:verified] = false
    end

    render json: pr_data
  end

  private

  def belongs_to_company_org?(owner)
    return false unless Current.user

    # Check if any of the user's companies have this org connected
    Current.user.clients.where(github_org_login: owner).exists? ||
      Current.user.companies.where(github_org_login: owner).exists?
  end

  def build_oauth_url
    client_id = ENV.fetch("GITHUB_CLIENT_ID", nil)
    redirect_uri = "#{ENV.fetch('FRONTEND_URL', 'http://localhost:3000')}/settings/github/callback"
    scope = "read:user,repo"
    state = SecureRandom.hex(16)

    # Store state in session for CSRF protection
    session[:github_oauth_state] = state

    "https://github.com/login/oauth/authorize?client_id=#{client_id}&redirect_uri=#{CGI.escape(redirect_uri)}&scope=#{scope}&state=#{state}"
  end

  def exchange_code_for_token(code)
    uri = URI("https://github.com/login/oauth/access_token")
    request = Net::HTTP::Post.new(uri)
    request["Accept"] = "application/json"
    request.set_form_data(
      "client_id" => ENV.fetch("GITHUB_CLIENT_ID", nil),
      "client_secret" => ENV.fetch("GITHUB_CLIENT_SECRET", nil),
      "code" => code
    )

    response = Net::HTTP.start(uri.hostname, uri.port, use_ssl: true) do |http|
      http.request(request)
    end

    JSON.parse(response.body)
  rescue JSON::ParserError, Net::HTTPError => e
    Rails.logger.error("GitHub token exchange error: #{e.message}")
    nil
  end

  def fetch_github_user(access_token)
    uri = URI("https://api.github.com/user")
    request = Net::HTTP::Get.new(uri)
    request["Accept"] = "application/vnd.github+json"
    request["Authorization"] = "Bearer #{access_token}"
    request["User-Agent"] = "Flexile-App"

    response = Net::HTTP.start(uri.hostname, uri.port, use_ssl: true) do |http|
      http.request(request)
    end

    return nil unless response.is_a?(Net::HTTPSuccess)

    JSON.parse(response.body)
  rescue JSON::ParserError, Net::HTTPError => e
    Rails.logger.error("GitHub user fetch error: #{e.message}")
    nil
  end
end
