# frozen_string_literal: true

module Github
  class OauthService
    GITHUB_OAUTH_URL = "https://github.com/login/oauth"
    GITHUB_API_URL = "https://api.github.com"

    REQUIRED_SCOPES = %w[read:org].freeze

    attr_reader :company

    def initialize(company:)
      @company = company
    end

    def authorization_url
      params = {
        client_id: client_id,
        redirect_uri: redirect_uri,
        scope: REQUIRED_SCOPES.join(" "),
        state: generate_state,
        allow_signup: "false"
      }

      "#{GITHUB_OAUTH_URL}/authorize?#{params.to_query}"
    end

    def exchange_code_for_token(code:)
      response = HTTParty.post(
        "#{GITHUB_OAUTH_URL}/access_token",
        body: {
          client_id: client_id,
          client_secret: client_secret,
          code: code,
          redirect_uri: redirect_uri
        },
        headers: {
          "Accept" => "application/json"
        }
      )

      unless response.success?
        Rails.logger.error "GitHub OAuth token exchange failed: #{response.code} - #{response.body}"
        raise OauthError, "Failed to exchange code for access token"
      end

      parsed = response.parsed_response

      if parsed["error"].present?
        Rails.logger.error "GitHub OAuth error: #{parsed['error']} - #{parsed['error_description']}"
        raise OauthError, parsed["error_description"] || parsed["error"]
      end

      {
        access_token: parsed["access_token"],
        token_type: parsed["token_type"],
        scope: parsed["scope"]
      }
    end

    def fetch_user_organizations(access_token:)
      response = HTTParty.get(
        "#{GITHUB_API_URL}/user/orgs",
        headers: api_headers(access_token)
      )

      unless response.success?
        Rails.logger.error "GitHub API fetch orgs failed: #{response.code} - #{response.body}"
        raise ApiError, "Failed to fetch organizations"
      end

      response.parsed_response.map do |org|
        {
          id: org["id"],
          login: org["login"],
          avatar_url: org["avatar_url"],
          description: org["description"]
        }
      end
    end

    def fetch_organization(access_token:, org_name:)
      response = HTTParty.get(
        "#{GITHUB_API_URL}/orgs/#{org_name}",
        headers: api_headers(access_token)
      )

      unless response.success?
        Rails.logger.error "GitHub API fetch org failed: #{response.code} - #{response.body}"
        raise ApiError, "Failed to fetch organization details"
      end

      org = response.parsed_response
      {
        id: org["id"],
        login: org["login"],
        name: org["name"],
        avatar_url: org["avatar_url"],
        description: org["description"]
      }
    end

    def verify_pull_request(access_token:, owner:, repo:, pr_number:)
      response = HTTParty.get(
        "#{GITHUB_API_URL}/repos/#{owner}/#{repo}/pulls/#{pr_number}",
        headers: api_headers(access_token)
      )

      unless response.success?
        Rails.logger.error "GitHub API fetch PR failed: #{response.code} - #{response.body}"
        return nil
      end

      pr = response.parsed_response
      {
        number: pr["number"],
        title: pr["title"],
        state: pr["state"],
        merged: pr["merged"],
        merged_at: pr["merged_at"],
        html_url: pr["html_url"],
        user: {
          login: pr["user"]["login"],
          id: pr["user"]["id"],
          avatar_url: pr["user"]["avatar_url"]
        },
        head: {
          ref: pr["head"]["ref"],
          repo: {
            full_name: pr["head"]["repo"]["full_name"]
          }
        },
        base: {
          ref: pr["base"]["ref"]
        }
      }
    end

    def valid_state?(state)
      return false if state.blank?

      begin
        decoded = Base64.strict_decode64(state)
        parts = decoded.split("|")
        return false unless parts.length == 2

        company_external_id = parts[0]
        timestamp = Time.parse(parts[1])

        company_external_id == company.external_id && timestamp > 10.minutes.ago
      rescue ArgumentError, TypeError
        false
      end
    end

    class OauthError < StandardError; end
    class ApiError < StandardError; end

    private

      def client_id
        ENV.fetch("GITHUB_CLIENT_ID")
      end

      def client_secret
        ENV.fetch("GITHUB_CLIENT_SECRET")
      end

      def redirect_uri
        "#{ENV.fetch('NEXT_PUBLIC_URL', 'http://localhost:3001')}/oauth_redirect"
      end

      def generate_state
        data = "#{company.external_id}|#{Time.current.iso8601}"
        Base64.strict_encode64(data)
      end

      def api_headers(access_token)
        {
          "Accept" => "application/vnd.github+json",
          "Authorization" => "Bearer #{access_token}",
          "X-GitHub-Api-Version" => "2022-11-28"
        }
      end
  end
end
