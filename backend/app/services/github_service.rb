# frozen_string_literal: true

class GithubService
  include HTTParty
  base_uri "https://api.github.com"

  GITHUB_OAUTH_URL = "https://github.com/login/oauth/authorize"
  GITHUB_TOKEN_URL = "https://github.com/login/oauth/access_token"

  # Scopes needed for user authentication and PR access
  USER_SCOPES = "read:user user:email"

  # Patterns for extracting bounty amounts from labels
  # Note: These patterns capture the raw value; conversion to cents happens in extract_bounty_from_labels
  BOUNTY_PATTERNS = [
    /\$(\d+(?:\.\d+)?)\s*k/i,                  # $3K, $3.5K, $3k
    /\$(\d+(?:\.\d+)?)\s*m/i,                  # $1M, $1.5M, $1m
    /\$(\d+(?:,\d{3})*(?:\.\d{2})?)/,          # $100, $1,000, $100.00
    /bounty[:\-_\s]*(\d+(?:,\d{3})*)/i,        # bounty:100, bounty-100, bounty_100, bounty 100
    /(\d+(?:,\d{3})*)\s*(?:usd|dollars?)/i,    # 100 USD, 100 dollars
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
        scope: USER_SCOPES,
        state: state,
      }

      "#{GITHUB_OAUTH_URL}?#{params.to_query}"
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

    def fetch_pr_details(access_token:, owner:, repo:, pr_number:)
      pr_response = api_request(access_token:, path: "/repos/#{owner}/#{repo}/pulls/#{pr_number}")

      # Try to extract bounty from PR labels first
      bounty_cents = extract_bounty_from_labels(pr_response["labels"])

      # If no bounty on PR, try to find it on a linked issue
      if bounty_cents.nil?
        bounty_cents = fetch_bounty_from_linked_issue(
          access_token: access_token,
          owner: owner,
          repo: repo,
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

        # Check other patterns
        BOUNTY_PATTERNS.each do |pattern|
          match = label_name.match(pattern)
          if match
            # Remove commas and convert to cents
            amount = match[1].delete(",").to_f
            return (amount * 100).to_i
          end
        end
      end

      nil
    end

    private
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
          "X-GitHub-Api-Version" => "2022-11-28",
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

      def pr_state(pr_response)
        if pr_response["merged_at"].present?
          "merged"
        elsif pr_response["state"] == "closed"
          "closed"
        else
          "open"
        end
      end

      def fetch_bounty_from_linked_issue(access_token:, owner:, repo:, pr_body:)
        return nil if pr_body.blank?

        # Find linked issue numbers from PR body
        # Matches: fixes #123, closes #123, resolves #123 (case insensitive)
        # Also matches: fixes owner/repo#123 for cross-repo references
        issue_numbers = extract_linked_issue_numbers(pr_body, owner, repo)

        issue_numbers.each do |issue_number|
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

        issue_numbers.uniq
      end
  end
end
