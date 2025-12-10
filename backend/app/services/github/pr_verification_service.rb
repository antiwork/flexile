# frozen_string_literal: true

module Github
  class PrVerificationService
    PR_URL_REGEX = %r{https://github\.com/(?<owner>[^/]+)/(?<repo>[^/]+)/pull/(?<number>\d+)}

    attr_reader :company

    def initialize(company:)
      @company = company
    end

    def verify_pr_url(url:)
      integration = company.github_integration
      return error_result("GitHub integration not connected") unless integration&.active?
      return error_result("GitHub access token is invalid or expired") unless integration.access_token_valid?

      match = url.match(PR_URL_REGEX)
      return error_result("Invalid GitHub PR URL format") unless match

      owner = match[:owner]
      repo = match[:repo]
      pr_number = match[:number].to_i

      oauth_service = Github::OauthService.new(company: company)
      pr_details = oauth_service.verify_pull_request(
        access_token: integration.access_token,
        owner: owner,
        repo: repo,
        pr_number: pr_number
      )

      return error_result("Pull request not found or not accessible") unless pr_details

      {
        success: true,
        pr: {
          number: pr_details[:number],
          title: pr_details[:title],
          state: pr_details[:state],
          merged: pr_details[:merged],
          merged_at: pr_details[:merged_at],
          html_url: pr_details[:html_url],
          author_login: pr_details[:user][:login],
          author_id: pr_details[:user][:id],
          author_avatar_url: pr_details[:user][:avatar_url],
          repository: pr_details[:head][:repo][:full_name],
          branch: pr_details[:head][:ref]
        }
      }
    end

    def parse_pr_url(url)
      match = url.match(PR_URL_REGEX)
      return nil unless match

      {
        owner: match[:owner],
        repo: match[:repo],
        number: match[:number].to_i
      }
    end

    private

      def error_result(message)
        { success: false, error: message }
      end
  end
end
