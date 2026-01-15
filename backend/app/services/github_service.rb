# frozen_string_literal: true

class GithubService
  include HTTParty
  base_uri "https://api.github.com"

  GITHUB_OAUTH_URL = "https://github.com/login/oauth/authorize"
  GITHUB_TOKEN_URL = "https://github.com/login/oauth/access_token"
  GITHUB_GRAPHQL_URL = "https://api.github.com/graphql"
  GITHUB_APP_INSTALLATION_URL = "https://github.com/apps"

  USER_SCOPES = "read:user user:email"
  ORG_SCOPES = "read:user user:email read:org"

  JWT_EXPIRATION = 10.minutes
  API_VERSION = "2022-11-28"
  GITHUB_ACCEPT_HEADER = "application/vnd.github+json"

  OAUTH_STATE_EXPIRATION = 30.minutes

  BOUNTY_PATTERNS = [
    /\$(\d+(?:,\d{3})*(?:\.\d{2})?)/,          # $100, $1,000, $100.00
    /bounty[:\-_\s]*(\d+(?:,\d{3})*)/i,        # bounty:100, bounty-100, bounty_100, bounty 100
    /(\d+(?:,\d{3})*)\s*(?:usd|dollars?)/i,    # 100 USD, 100 dollars
  ].freeze

  class Error < StandardError; end
  class ConfigurationError < Error; end
  class OAuthError < Error; end
  class ApiError < Error; end

  class << self
    def oauth_url(state:, redirect_uri:, include_orgs: false)
      params = {
        client_id: client_id,
        redirect_uri: redirect_uri,
        scope: include_orgs ? ORG_SCOPES : USER_SCOPES,
        state: state,
        allow_signup: false,
      }

      "#{GITHUB_OAUTH_URL}?#{params.to_query}"
    end

    def app_installation_url(state:, org_id: nil, redirect_uri: nil)
      app_slug = GlobalConfig.get("GH_APP_SLUG")
      return nil if app_slug.blank?

      url = "#{GITHUB_APP_INSTALLATION_URL}/#{app_slug}/installations/new?state=#{state}"
      url += "&suggested_target_id=#{org_id}" if org_id.present?
      url
    end

    def exchange_code_for_token(code:, redirect_uri:)
      response = HTTParty.post(GITHUB_TOKEN_URL,
                               headers: { "Accept" => "application/json" },
                               body: {
                                 client_id: client_id,
                                 client_secret: client_secret,
                                 code: code,
                                 redirect_uri: redirect_uri,
                               })

      if response["error"]
        raise OAuthError, response["error_description"] || response["error"]
      end

      response["access_token"]
    end

    def app_settings_url
      app_slug = GlobalConfig.get("GH_APP_SLUG")
      return nil if app_slug.blank?

      "https://github.com/apps/#{app_slug}/installations"
    end

    def app_uninstall_url(org_name:)
      app_slug = GlobalConfig.get("GH_APP_SLUG")
      return nil if app_slug.blank? || org_name.blank?

      "https://github.com/organizations/#{org_name}/settings/installations"
    end

    def fetch_user_info(access_token:)
      user_response = api_request(access_token:, path: "/user")

      {
        uid: user_response["id"].to_s,
        username: user_response["login"],
        email: user_response["email"],
        avatar_url: user_response["avatar_url"],
        name: user_response["name"],
      }
    end

    def fetch_user_orgs(access_token:)
      orgs_response = api_request(access_token:, path: "/user/orgs")

      orgs_response.map do |org|
        {
          login: org["login"],
          id: org["id"],
          avatar_url: org["avatar_url"],
        }
      end
    end

    # Fetch installations of this GitHub App accessible to the user
    # This returns all installations the user can access (their own and orgs they admin)
    def fetch_user_app_installations(access_token:)
      # This endpoint returns installations of the authenticated GitHub App
      # that the authenticated user has access to
      response = api_request(access_token:, path: "/user/installations")

      installations = response["installations"] || []
      installations.map do |installation|
        {
          id: installation["id"],
          account: {
            login: installation.dig("account", "login"),
            id: installation.dig("account", "id"),
            avatar_url: installation.dig("account", "avatar_url"),
            type: installation.dig("account", "type"),
          },
        }
      end
    rescue ApiError => e
      Rails.logger.error "[GitHub] Failed to fetch user installations: #{e.message}"
      []
    end

    # Find a specific installation by ID from user's accessible installations
    def find_installation_for_user(access_token:, installation_id:)
      installations = fetch_user_app_installations(access_token: access_token)
      installations.find { |i| i[:id].to_s == installation_id.to_s }
    end

    def fetch_installation_details(installation_id:)
      # Use JWT authentication to fetch installation details
      # This requires the GitHub App's private key, which we don't have in this flow
      # Instead, we'll fetch it using the user's access token if they have access
      # Or we can get it from the installation webhook

      # For now, return minimal info - the actual org details will come from GitHub's redirect
      { installation_id: installation_id }
    end

    def fetch_pr_details(access_token:, owner:, repo:, pr_number:)
      pr_response = api_request(access_token:, path: "/repos/#{owner}/#{repo}/pulls/#{pr_number}")

      bounty_cents = extract_bounty_from_labels(pr_response["labels"])
      if bounty_cents.nil?
        bounty_cents = fetch_bounty_from_linked_issue(
          access_token: access_token,
          owner: owner,
          repo: repo,
          pr_number: pr_number,
          pr_body: pr_response["body"]
        )
      end

      {
        url: pr_response["html_url"],
        number: pr_response["number"],
        title: pr_response["title"],
        state: pr_state(pr_response),
        author: pr_response["user"]["login"],
        author_avatar_url: pr_response["user"]["avatar_url"],
        repo: "#{owner}/#{repo}",
        bounty_cents: bounty_cents,
        created_at: pr_response["created_at"],
        merged_at: pr_response["merged_at"],
        closed_at: pr_response["closed_at"],
      }
    end

    def fetch_issue_labels(access_token:, owner:, repo:, issue_number:)
      issue_response = api_request(access_token:, path: "/repos/#{owner}/#{repo}/issues/#{issue_number}")
      issue_response["labels"]
    rescue ApiError
      # Issue might not exist or be inaccessible
      nil
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
                    nodes {
                      name
                    }
                  }
                }
              }
            }
          }
        }
      GRAPHQL

      response = graphql_request(
        access_token: access_token,
        query: query,
        variables: { owner: owner, repo: repo, number: pr_number }
      )

      pull_request = response.dig("data", "repository", "pullRequest")
      return [] unless pull_request

      issues = pull_request.dig("closingIssuesReferences", "nodes") || []
      issues.map do |issue|
        labels = (issue.dig("labels", "nodes") || []).map { |l| { "name" => l["name"] } }
        { number: issue["number"], labels: labels }
      end
    rescue ApiError
      # GraphQL request failed, return empty array
      []
    end

    def fetch_pr_details_from_url(access_token:, url:)
      parsed = parse_pr_url(url)
      return nil unless parsed

      fetch_pr_details(
        access_token: access_token,
        owner: parsed[:owner],
        repo: parsed[:repo],
        pr_number: parsed[:pr_number]
      )
    end

    def parse_pr_url(url)
      # Matches: https://github.com/owner/repo/pull/123
      match = url.match(%r{github\.com/([^/]+)/([^/]+)/pull/(\d+)})
      return nil unless match

      {
        owner: match[1],
        repo: match[2],
        pr_number: match[3].to_i,
      }
    end

    def valid_pr_url?(url)
      parse_pr_url(url).present?
    end

    def extract_bounty_from_labels(labels)
      return nil if labels.blank?

      labels.each do |label|
        label_name = label["name"].to_s

        # Check for K suffix (thousands)
        if (match = label_name.match(/\$(\d+(?:\.\d+)?)\s*k/i))
          amount = match[1].to_f * 1000
          return (amount * 100).to_i
        end

        # Check for M suffix (millions)
        if (match = label_name.match(/\$(\d+(?:\.\d+)?)\s*m/i))
          amount = match[1].to_f * 1_000_000
          return (amount * 100).to_i
        end

        # Check standard patterns
        BOUNTY_PATTERNS.each do |pattern|
          match = label_name.match(pattern)
          if match
            amount = match[1].delete(",").to_f
            return (amount * 100).to_i
          end
        end
      end

      nil
    end

    # ============================================
    # GitHub App Authentication (using private key)
    # ============================================

    # Check if GitHub App authentication is configured
    def app_configured?
      app_id.present? && app_private_key.present?
    end

    # Generate a JWT for GitHub App authentication
    # This JWT is used to authenticate as the GitHub App itself
    def generate_app_jwt
      raise ConfigurationError, "GitHub App is not configured (missing GH_APP_ID or GH_APP_PRIVATE_KEY)" unless app_configured?

      private_key = OpenSSL::PKey::RSA.new(app_private_key)
      now = Time.now.to_i
      payload = {
        iat: now - 60,
        exp: now + (JWT_EXPIRATION.to_i - 60),
        iss: app_id,
      }

      JWT.encode(payload, private_key, "RS256")
    end

    # Get an installation access token for a specific installation
    # This token can be used to make API calls on behalf of the installed app
    def get_installation_access_token(installation_id:)
      jwt = generate_app_jwt

      response = HTTParty.post(
        "https://api.github.com/app/installations/#{installation_id}/access_tokens",
        headers: github_app_headers(jwt),
      )

      unless response.success?
        error_msg = response["message"] || response.code
        Rails.logger.error "[GitHub] Failed to get installation access token for installation #{installation_id}: #{error_msg}"
        Rails.logger.error "[GitHub] Response body: #{response.body}"
        raise ApiError, "Failed to get installation access token: #{error_msg}"
      end

      response["token"]
    end

    # Fetch installation details using App JWT authentication
    def fetch_installation(installation_id:)
      jwt = generate_app_jwt

      response = HTTParty.get(
        "https://api.github.com/app/installations/#{installation_id}",
        headers: github_app_headers(jwt),
      )

      unless response.success?
        Rails.logger.error "[GitHub] Failed to fetch installation #{installation_id}: #{response.code} - #{response.body}"
        return nil
      end

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
    rescue ConfigurationError => e
      Rails.logger.warn "[GitHub] App not configured, cannot fetch installation: #{e.message}"
      nil
    end

    # Delete/uninstall a GitHub App installation
    # This completely removes the app from the organization/user account
    def delete_installation(installation_id:)
      jwt = generate_app_jwt

      response = HTTParty.delete(
        "https://api.github.com/app/installations/#{installation_id}",
        headers: github_app_headers(jwt),
      )

      if response.code == 204
        Rails.logger.info "[GitHub] Successfully deleted installation #{installation_id}"
        true
      else
        Rails.logger.error "[GitHub] Failed to delete installation #{installation_id}: #{response.code} - #{response.body}"
        false
      end
    rescue ConfigurationError => e
      Rails.logger.warn "[GitHub] App not configured, cannot delete installation: #{e.message}"
      false
    end

    # List all installations of this GitHub App
    def list_app_installations
      jwt = generate_app_jwt

      response = HTTParty.get(
        "https://api.github.com/app/installations",
        headers: github_app_headers(jwt),
      )

      unless response.success?
        raise ApiError, "Failed to list installations: #{response["message"] || response.code}"
      end

      response.parsed_response.map do |installation|
        {
          id: installation["id"],
          account: {
            login: installation.dig("account", "login"),
            id: installation.dig("account", "id"),
            avatar_url: installation.dig("account", "avatar_url"),
            type: installation.dig("account", "type"),
          },
        }
      end
    rescue ConfigurationError => e
      Rails.logger.warn "[GitHub] App not configured, cannot list installations: #{e.message}"
      []
    end

    # Find installation by organization/user login name
    def find_installation_by_account(account_login:)
      installations = list_app_installations
      installations.find { |i| i.dig(:account, :login)&.downcase == account_login.downcase }
    end

    # ============================================
    # GitHub App-based API methods
    # These use installation access tokens instead of user OAuth tokens
    # ============================================

    # Fetch PR details using GitHub App installation token
    # This doesn't require user's personal OAuth token
    def fetch_pr_details_with_app(org_name:, owner:, repo:, pr_number:)
      installation = find_installation_by_account(account_login: org_name)
      raise ApiError, "GitHub App not installed on #{org_name}" unless installation

      token = get_installation_access_token(installation_id: installation[:id])
      fetch_pr_details(access_token: token, owner: owner, repo: repo, pr_number: pr_number)
    end

    # Fetch PR details from URL using GitHub App installation token
    def fetch_pr_details_from_url_with_app(org_name:, url:)
      parsed = parse_pr_url(url)
      return nil unless parsed

      fetch_pr_details_with_app(
        org_name: org_name,
        owner: parsed[:owner],
        repo: parsed[:repo],
        pr_number: parsed[:pr_number]
      )
    end

    # Determine PR state from GitHub API response
    # Used by both GithubService and webhooks for consistency
    def pr_state(pr_response)
      if pr_response["merged_at"].present? || pr_response["merged"] == true
        "merged"
      elsif pr_response["draft"] == true
        "draft"
      elsif pr_response["state"] == "closed"
        "closed"
      else
        "open"
      end
    end

    # Generate a signed state token for OAuth/installation flows
    def generate_state_token(**params)
      random_token = SecureRandom.hex(16)
      timestamp = Time.current.to_i
      state_data = ([random_token] + params.values.map(&:to_s) + [timestamp]).join(":")
      signature = OpenSSL::HMAC.hexdigest("SHA256", Rails.application.secret_key_base, state_data)
      "#{state_data}:#{signature}"
    end

    # Verify a state token and return the embedded parameters
    # Returns nil if invalid or expired
    def verify_state_token(state, *expected_keys)
      return nil if state.blank?

      parts = state.split(":")
      expected_parts_count = 2 + expected_keys.length + 1 # random + params + timestamp + signature
      return nil if parts.length != expected_parts_count

      signature = parts.pop
      timestamp_str = parts.pop
      params_values = parts[1..] # Skip random token

      state_data = (parts + [timestamp_str]).join(":")
      expected_signature = OpenSSL::HMAC.hexdigest("SHA256", Rails.application.secret_key_base, state_data)

      return nil unless ActiveSupport::SecurityUtils.secure_compare(signature, expected_signature)

      timestamp = timestamp_str.to_i
      return nil if Time.current.to_i - timestamp > OAUTH_STATE_EXPIRATION.to_i

      expected_keys.zip(params_values).to_h
    end

    private
      def github_app_headers(jwt)
        {
          "Authorization" => "Bearer #{jwt}",
          "Accept" => GITHUB_ACCEPT_HEADER,
          "X-GitHub-Api-Version" => API_VERSION,
        }
      end

      def app_id
        GlobalConfig.get("GH_APP_ID")
      end

      def app_private_key
        key = GlobalConfig.get("GH_APP_PRIVATE_KEY")
        return nil if key.blank?

        # Handle the key whether it's stored with actual newlines or escaped \n
        # Support both single-escaped (\n) and double-escaped (\\n) formats
        key.gsub('\n', "\n")
      end

      def client_id
        id = GlobalConfig.get("GH_CLIENT_ID")
        raise ConfigurationError, "GH_CLIENT_ID is not configured" if id.blank?
        id
      end

      def client_secret
        secret = GlobalConfig.get("GH_CLIENT_SECRET")
        raise ConfigurationError, "GH_CLIENT_SECRET is not configured" if secret.blank?
        secret
      end

      def api_request(access_token:, path:, method: :get, body: nil)
        headers = {
          "Authorization" => "Bearer #{access_token}",
          "Accept" => "application/vnd.github.v3+json",
          "X-GitHub-Api-Version" => API_VERSION,
        }

        response = case method
                   when :get
                     GithubService.get(path, headers: headers)
                   when :post
                     GithubService.post(path, headers: headers.merge("Content-Type" => "application/json"), body: body.to_json)
                   else
                     raise ArgumentError, "Unsupported HTTP method: #{method}"
        end

        unless response.success?
          raise ApiError, response["message"] || "GitHub API error: #{response.code}"
        end

        response.parsed_response
      end

      def graphql_request(access_token:, query:, variables: {})
        headers = {
          "Authorization" => "Bearer #{access_token}",
          "Content-Type" => "application/json",
        }

        body = { query: query, variables: variables }.to_json

        response = HTTParty.post(GITHUB_GRAPHQL_URL, headers: headers, body: body)

        unless response.success?
          error_message = response.dig("errors", 0, "message") || response["message"] || "GitHub GraphQL error: #{response.code}"
          raise ApiError, error_message
        end

        if response["errors"].present?
          raise ApiError, response["errors"].first["message"]
        end

        response.parsed_response
      end

      def fetch_bounty_from_linked_issue(access_token:, owner:, repo:, pr_number:, pr_body:)
        # Check UI-linked issues first (via GraphQL, which includes labels)
        linked_issues = fetch_linked_issues(
          access_token: access_token,
          owner: owner,
          repo: repo,
          pr_number: pr_number
        )

        linked_issues.each do |issue|
          bounty_cents = extract_bounty_from_labels(issue[:labels])
          return bounty_cents if bounty_cents.present?
        end

        # Fall back to parsing PR body for references not caught by GraphQL (e.g., "Issue: #123")
        return nil if pr_body.blank?

        issue_numbers_from_body = extract_linked_issue_numbers(pr_body, owner, repo)
        linked_issue_numbers = linked_issues.map { |i| i[:number] }
        new_issue_numbers = issue_numbers_from_body - linked_issue_numbers

        new_issue_numbers.each do |issue_number|
          labels = fetch_issue_labels(
            access_token: access_token,
            owner: owner,
            repo: repo,
            issue_number: issue_number
          )

          bounty_cents = extract_bounty_from_labels(labels)
          return bounty_cents if bounty_cents.present?
        end

        nil
      end

      def extract_linked_issue_numbers(pr_body, owner, repo)
        issue_numbers = []

        # Pattern for "fixes #123", "closes #123", "resolves #123"
        # Also handles "fix #123", "close #123", "resolve #123"
        simple_pattern = /(?:fix(?:e[sd])?|close[sd]?|resolve[sd]?)\s+#(\d+)/i
        pr_body.scan(simple_pattern) do |match|
          issue_numbers << match[0].to_i
        end

        # Pattern for cross-repo references: "fixes owner/repo#123"
        cross_repo_pattern = /(?:fix(?:e[sd])?|close[sd]?|resolve[sd]?)\s+#{Regexp.escape(owner)}\/#{Regexp.escape(repo)}#(\d+)/i
        pr_body.scan(cross_repo_pattern) do |match|
          issue_numbers << match[0].to_i
        end

        # Pattern for "Issue: #123" format (common in PR templates)
        issue_label_pattern = /Issue:\s*#(\d+)/i
        pr_body.scan(issue_label_pattern) do |match|
          issue_numbers << match[0].to_i
        end

        # Pattern for full GitHub issue URLs: "https://github.com/owner/repo/issues/123"
        url_pattern = %r{https?://github\.com/#{Regexp.escape(owner)}/#{Regexp.escape(repo)}/issues/(\d+)}i
        pr_body.scan(url_pattern) do |match|
          issue_numbers << match[0].to_i
        end

        issue_numbers.uniq
      end
  end
end
