# frozen_string_literal: true

class IntegrationApi::Github < IntegrationApi::Base
  ALLOWED_WEBHOOK_EVENTS = %w[issues pull_request]
  ALLOWED_WEBHOOK_ACTIONS = %w[reopened closed edited]
  BASE_API_URL = "https://api.github.com"
  BASE_OAUTH_URL = "https://github.com/login/oauth/authorize"
  OAUTH_TOKEN_URL = "https://github.com/login/oauth/access_token"
  SCOPE = "repo,admin:org_hook"
  GITHUB_API_VERSION = "2022-11-28"
  SUPPORTED_RESOURCE_TYPES = %w[issues pulls]
  private_constant :BASE_API_URL, :BASE_OAUTH_URL, :OAUTH_TOKEN_URL, :SCOPE, :GITHUB_API_VERSION

  delegate :organizations, :webhooks, to: :integration, allow_nil: true

  def initialize(company_id:)
    super(company_id:)
    @integration = company.github_integration
    @client_id = GlobalConfig.get("GH_CLIENT_ID")
    @client_secret = GlobalConfig.get("GH_CLIENT_SECRET")
  end

  def oauth_location
    uri = URI(BASE_OAUTH_URL)
    query_params = Array.new
    query_params.push(["client_id", client_id])
    query_params.push(["scope", SCOPE])
    query_params.push(["redirect_uri", OAUTH_REDIRECT_URL])
    query_params.push(["state", state])

    query_params.each do |element|
      params = URI.decode_www_form(uri.query || "") << element
      uri.query = URI.encode_www_form(params)
    end

    uri
  end

  def get_oauth_token(code)
    body = {
      client_id:,
      client_secret:,
      code:,
      redirect_uri: OAUTH_REDIRECT_URL,
    }

    make_api_request(method: "POST", url: OAUTH_TOKEN_URL, body: URI.encode_www_form(body), headers: { "Accept" => "application/json" })
  end

  def revoke_token
    url = "#{BASE_API_URL}/applications/#{client_id}/grant"
    body = { access_token: }.to_json
    make_api_request(method: "DELETE", url:, body:, headers: oauth_request_header)
  end

  def fetch_account_id(token)
    make_api_request(method: "GET", url: "#{BASE_API_URL}/user", headers: api_request_header(token:)).parsed_response["id"]
  end

  def fetch_organizations(token)
    url = "#{BASE_API_URL}/user/memberships/orgs?state=active"
    response = make_api_request(method: "GET", url:, headers: api_request_header(token:))

    if response.success?
      response.parsed_response.map { _1.dig("organization", "login") }
    else
      Bugsnag.notify("Failed to fetch GitHub organizations: #{response.parsed_response}")
      []
    end
  end

  def create_webhooks!
    return if webhooks.present?

    integration.webhooks = []
    organizations.each do |organization|
      response = make_api_request(method: "POST", url: "#{BASE_API_URL}/orgs/#{organization}/hooks", body: {
        name: "web",
        config: {
          url: Rails.application.routes.url_helpers.webhooks_github_url,
          secret: GlobalConfig.get("GH_WEBHOOK_SECRET"),
          content_type: "json",
        },
        events: ALLOWED_WEBHOOK_EVENTS,
        active: true,
      }.to_json, headers: api_request_header)

      integration.webhooks << { id: response.parsed_response["id"].to_s, organization: }
    end

    integration.save!
  end

  def delete_webhooks!
    return unless webhooks.present?

    webhooks.each do |webhook|
      response = make_api_request(method: "DELETE", url: "#{BASE_API_URL}/orgs/#{webhook["organization"]}/hooks/#{webhook["id"]}", headers: api_request_header)

      return unless response.success?

      integration.webhooks.delete_if { _1[:id] == webhook[:id] }
    end

    integration.save!
  end

  private
    def oauth_request_header
      {
        "Accept" => "application/vnd.github+json",
        "X-GitHub-Api-Version" => GITHUB_API_VERSION,
        "Authorization" => "Basic #{Base64.strict_encode64("#{client_id}:#{client_secret}")}",
      }
    end

    def api_request_header(token: access_token)
      {
        "Authorization" => "Bearer #{token}",
        "Accept" => "application/vnd.github.v3+json",
        "X-GitHub-Api-Version" => GITHUB_API_VERSION,
      }
    end
end
