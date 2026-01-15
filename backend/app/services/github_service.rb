# frozen_string_literal: true

class GithubService
  include HTTParty
  base_uri "https://api.github.com"

  OAUTH_URL = "https://github.com/login/oauth/authorize"
  TOKEN_URL = "https://github.com/login/oauth/access_token"
  GRAPHQL_URL = "https://api.github.com/graphql"
  APP_INSTALLATION_URL = "https://github.com/apps"

  OAUTH_SCOPES = "read:user user:email"
  API_VERSION = "2022-11-28"
  JWT_EXPIRATION = 10.minutes
  STATE_EXPIRATION = 30.minutes

  BOUNTY_PATTERNS = [
    [/\$(\d+(?:\.\d+)?)\s*k/i, ->(m) { (m[1].to_f * 1000 * 100).to_i }],                      # $3K, $3.5K, $3k
    [/\$(\d+(?:\.\d+)?)\s*m/i, ->(m) { (m[1].to_f * 1_000_000 * 100).to_i }],                 # $1M, $1.5M, $1m
    [/\$(\d+(?:,\d{3})*(?:\.\d{2})?)/,  ->(m) { (m[1].delete(",").to_f * 100).to_i }],        # $100, $1,000, $100.00
    [/bounty[:\-_\s]*(\d+(?:,\d{3})*)/i, ->(m) { (m[1].delete(",").to_f * 100).to_i }],       # bounty:100, bounty-100, bounty_100, bounty 100
    [/(\d+(?:,\d{3})*)\s*(?:usd|dollars?)/i, ->(m) { (m[1].delete(",").to_f * 100).to_i }],   # 100 USD, 100 dollars
  ].freeze

  class Error < StandardError; end
  class ConfigurationError < Error; end
  class OAuthError < Error; end
  class ApiError < Error; end

  class << self
    def oauth_url(state:, redirect_uri:)
      params = {
        client_id: client_id,
        redirect_uri: redirect_uri,
        scope: OAUTH_SCOPES,
        state: state,
        allow_signup: false,
      }
      "#{OAUTH_URL}?#{params.to_query}"
    end

    def app_installation_url(state:, org_id: nil, redirect_uri: nil)
      app_slug = GlobalConfig.get("GH_APP_SLUG")
      return nil if app_slug.blank?

      url = "#{APP_INSTALLATION_URL}/#{app_slug}/installations/new?state=#{state}"
      url += "&suggested_target_id=#{org_id}" if org_id.present?
      url
    end

    def exchange_code_for_token(code:, redirect_uri:)
      response = HTTParty.post(TOKEN_URL,
                               headers: { "Accept" => "application/json" },
                               body: { client_id: client_id, client_secret: client_secret, code: code, redirect_uri: redirect_uri })

      raise OAuthError, response["error_description"] || response["error"] if response["error"]
      response["access_token"]
    end

    def fetch_user_info(access_token:)
      response = api_request(access_token: access_token, path: "/user")
      {
        uid: response["id"].to_s,
        username: response["login"],
        email: response["email"],
        avatar_url: response["avatar_url"],
        name: response["name"],
      }
    end

    def fetch_pr_details(access_token:, owner:, repo:, pr_number:)
      pr = api_request(access_token: access_token, path: "/repos/#{owner}/#{repo}/pulls/#{pr_number}")

      bounty = extract_bounty_from_labels(pr["labels"]) ||
               fetch_bounty_from_linked_issue(access_token: access_token, owner: owner, repo: repo, pr_number: pr_number, pr_body: pr["body"])

      {
        url: pr["html_url"],
        number: pr["number"],
        title: pr["title"],
        state: pr_state(pr),
        author: pr["user"]["login"],
        author_avatar_url: pr["user"]["avatar_url"],
        repo: "#{owner}/#{repo}",
        bounty_cents: bounty,
        created_at: pr["created_at"],
        merged_at: pr["merged_at"],
        closed_at: pr["closed_at"],
      }
    end

    def fetch_linked_issues(access_token:, owner:, repo:, pr_number:)
      query = <<~GRAPHQL
        query($owner: String!, $repo: String!, $number: Int!) {
          repository(owner: $owner, name: $repo) {
            pullRequest(number: $number) {
              closingIssuesReferences(first: 10) {
                nodes {
                  number
                  labels(first: 20) {
                    nodes { name }
                  }
                }
              }
            }
          }
        }
      GRAPHQL

      response = graphql_request(access_token: access_token, query: query, variables: { owner: owner, repo: repo, number: pr_number })
      issues = response.dig("data", "repository", "pullRequest", "closingIssuesReferences", "nodes") || []
      issues.map { |i| { number: i["number"], labels: (i.dig("labels", "nodes") || []).map { |l| { "name" => l["name"] } } } }
    rescue ApiError
      []
    end

    def fetch_pr_details_from_url(access_token:, url:)
      parsed = parse_pr_url(url)
      parsed ? fetch_pr_details(access_token: access_token, **parsed) : nil
    end

    def parse_pr_url(url)
      match = url&.match(%r{github\.com/([^/]+)/([^/]+)/pull/(\d+)})
      match ? { owner: match[1], repo: match[2], pr_number: match[3].to_i } : nil
    end

    def valid_pr_url?(url)
      parse_pr_url(url).present?
    end

    def extract_bounty_from_labels(labels)
      return nil if labels.blank?

      labels.each do |label|
        name = label["name"].to_s
        BOUNTY_PATTERNS.each do |pattern, converter|
          match = name.match(pattern)
          return converter.call(match) if match
        end
      end
      nil
    end

    def app_configured?
      app_id.present? && app_private_key.present?
    end

    def generate_app_jwt
      raise ConfigurationError, "GitHub App not configured" unless app_configured?

      private_key = OpenSSL::PKey::RSA.new(app_private_key)
      now = Time.now.to_i
      payload = { iat: now - 60, exp: now + JWT_EXPIRATION.to_i - 60, iss: app_id }
      JWT.encode(payload, private_key, "RS256")
    end

    def get_installation_access_token(installation_id:)
      jwt = generate_app_jwt
      response = HTTParty.post("https://api.github.com/app/installations/#{installation_id}/access_tokens", headers: app_headers(jwt))

      raise ApiError, "Failed to get installation token: #{response["message"] || response.code}" unless response.success?
      response["token"]
    end

    def fetch_installation(installation_id:)
      jwt = generate_app_jwt
      response = HTTParty.get("https://api.github.com/app/installations/#{installation_id}", headers: app_headers(jwt))

      return nil unless response.success?

      {
        id: response["id"],
        account: {
          login: response.dig("account", "login"),
          id: response.dig("account", "id"),
          avatar_url: response.dig("account", "avatar_url"),
          type: response.dig("account", "type"),
        },
        target_type: response["target_type"],
        permissions: response["permissions"],
      }
    rescue ConfigurationError
      nil
    end

    def delete_installation(installation_id:)
      jwt = generate_app_jwt
      response = HTTParty.delete("https://api.github.com/app/installations/#{installation_id}", headers: app_headers(jwt))
      response.code == 204
    rescue ConfigurationError
      false
    end

    def list_app_installations
      jwt = generate_app_jwt
      response = HTTParty.get("https://api.github.com/app/installations", headers: app_headers(jwt))

      raise ApiError, "Failed to list installations: #{response["message"] || response.code}" unless response.success?

      response.parsed_response.map do |i|
        { id: i["id"], account: { login: i.dig("account", "login"), id: i.dig("account", "id"), avatar_url: i.dig("account", "avatar_url"), type: i.dig("account", "type") } }
      end
    rescue ConfigurationError
      []
    end

    def find_installation_by_account(account_login:)
      list_app_installations.find { |i| i.dig(:account, :login)&.downcase == account_login.downcase }
    end

    def fetch_pr_details_with_app(org_name:, owner:, repo:, pr_number:)
      installation = find_installation_by_account(account_login: org_name)
      raise ApiError, "GitHub App not installed on #{org_name}" unless installation

      token = get_installation_access_token(installation_id: installation[:id])
      fetch_pr_details(access_token: token, owner: owner, repo: repo, pr_number: pr_number)
    end

    def fetch_pr_details_from_url_with_app(org_name:, url:)
      parsed = parse_pr_url(url)
      parsed ? fetch_pr_details_with_app(org_name: org_name, **parsed) : nil
    end

    def pr_state(pr)
      return "merged" if pr["merged_at"].present? || pr["merged"] == true
      return "draft" if pr["draft"] == true
      return "closed" if pr["state"] == "closed"
      "open"
    end

    def generate_state_token(**params)
      random = SecureRandom.hex(16)
      timestamp = Time.current.to_i
      data = ([random] + params.values.map(&:to_s) + [timestamp]).join(":")
      signature = OpenSSL::HMAC.hexdigest("SHA256", Rails.application.secret_key_base, data)
      "#{data}:#{signature}"
    end

    def verify_state_token(state, *expected_keys)
      return nil if state.blank?

      parts = state.split(":")
      return nil if parts.length != 2 + expected_keys.length + 1

      signature = parts.pop
      timestamp = parts.pop.to_i
      params = parts[1..]

      data = (parts + [timestamp.to_s]).join(":")
      expected_sig = OpenSSL::HMAC.hexdigest("SHA256", Rails.application.secret_key_base, data)

      return nil unless ActiveSupport::SecurityUtils.secure_compare(signature, expected_sig)
      return nil if Time.current.to_i - timestamp > STATE_EXPIRATION.to_i

      expected_keys.zip(params).to_h
    end

    private
      def app_headers(jwt)
        { "Authorization" => "Bearer #{jwt}", "Accept" => "application/vnd.github+json", "X-GitHub-Api-Version" => API_VERSION }
      end

      def app_id
        GlobalConfig.get("GH_APP_ID")
      end

      def app_private_key
        key = GlobalConfig.get("GH_APP_PRIVATE_KEY")
        key&.gsub('\n', "\n")
      end

      def client_id
        id = GlobalConfig.get("GH_CLIENT_ID")
        raise ConfigurationError, "GH_CLIENT_ID not configured" if id.blank?
        id
      end

      def client_secret
        secret = GlobalConfig.get("GH_CLIENT_SECRET")
        raise ConfigurationError, "GH_CLIENT_SECRET not configured" if secret.blank?
        secret
      end

      def api_request(access_token:, path:, method: :get, body: nil)
        headers = { "Authorization" => "Bearer #{access_token}", "Accept" => "application/vnd.github.v3+json", "X-GitHub-Api-Version" => API_VERSION }

        response = case method
                   when :get then get(path, headers: headers)
                   when :post then post(path, headers: headers.merge("Content-Type" => "application/json"), body: body.to_json)
                   else raise ArgumentError, "Unsupported method: #{method}"
        end

        raise ApiError, response["message"] || "GitHub API error: #{response.code}" unless response.success?
        response.parsed_response
      end

      def graphql_request(access_token:, query:, variables: {})
        response = HTTParty.post(GRAPHQL_URL,
                                 headers: { "Authorization" => "Bearer #{access_token}", "Content-Type" => "application/json" },
                                 body: { query: query, variables: variables }.to_json)

        raise ApiError, response.dig("errors", 0, "message") || response["message"] || "GraphQL error: #{response.code}" unless response.success?
        raise ApiError, response["errors"].first["message"] if response["errors"].present?

        response.parsed_response
      end

      def fetch_bounty_from_linked_issue(access_token:, owner:, repo:, pr_number:, pr_body:)
        linked = fetch_linked_issues(access_token: access_token, owner: owner, repo: repo, pr_number: pr_number)

        linked.each do |issue|
          bounty = extract_bounty_from_labels(issue[:labels])
          return bounty if bounty
        end

        return nil if pr_body.blank?

        new_numbers = extract_linked_issue_numbers(pr_body, owner, repo) - linked.map { |i| i[:number] }
        new_numbers.each do |num|
          labels = fetch_issue_labels(access_token: access_token, owner: owner, repo: repo, issue_number: num)
          bounty = extract_bounty_from_labels(labels)
          return bounty if bounty
        end

        nil
      end

      def fetch_issue_labels(access_token:, owner:, repo:, issue_number:)
        api_request(access_token: access_token, path: "/repos/#{owner}/#{repo}/issues/#{issue_number}")["labels"]
      rescue ApiError
        nil
      end

      def extract_linked_issue_numbers(body, owner, repo)
        numbers = []

        body.scan(/(?:fix(?:e[sd])?|close[sd]?|resolve[sd]?)\s+#(\d+)/i) { numbers << $1.to_i }
        body.scan(/(?:fix(?:e[sd])?|close[sd]?|resolve[sd]?)\s+#{Regexp.escape(owner)}\/#{Regexp.escape(repo)}#(\d+)/i) { numbers << $1.to_i }
        body.scan(/Issue:\s*#(\d+)/i) { numbers << $1.to_i }
        body.scan(%r{https?://github\.com/#{Regexp.escape(owner)}/#{Regexp.escape(repo)}/issues/(\d+)}i) { numbers << $1.to_i }

        numbers.uniq
      end
  end
end
