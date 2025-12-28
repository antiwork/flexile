# frozen_string_literal: true

require "net/http"
require "json"

class GithubService
  GITHUB_API_BASE = "https://api.github.com"

  attr_reader :access_token

  def initialize(access_token: nil)
    @access_token = access_token
  end

  # Fetch PR details from GitHub API
  def fetch_pr(owner:, repo:, number:)
    response = get("/repos/#{owner}/#{repo}/pulls/#{number}")
    return nil unless response.is_a?(Hash)

    {
      number: response["number"],
      title: response["title"],
      author: response.dig("user", "login"),
      merged_at: response["merged_at"],
      state: response["state"],
      url: response["html_url"],
      repo: "#{owner}/#{repo}",
      bounty_cents: extract_bounty_from_labels(response["labels"]),
    }
  end

  # Fetch issue details to get bounty from issue labels if not on PR
  def fetch_issue(owner:, repo:, number:)
    response = get("/repos/#{owner}/#{repo}/issues/#{number}")
    return nil unless response.is_a?(Hash)

    {
      bounty_cents: extract_bounty_from_labels(response["labels"]),
    }
  end

  # Verify if a user authored or contributed to a PR
  def verify_pr_author(owner:, repo:, number:, github_username:)
    pr_data = fetch_pr(owner: owner, repo: repo, number: number)
    return false unless pr_data

    pr_data[:author]&.downcase == github_username&.downcase
  end

  # Check if a PR URL has already been paid
  def pr_already_paid?(github_pr_url)
    InvoiceLineItem.joins(:invoice)
                   .where(github_pr_url: github_pr_url)
                   .where.not(invoices: { paid_at: nil })
                   .exists?
  end

  # Parse a GitHub PR URL and extract owner, repo, and number
  def self.parse_pr_url(url)
    return nil unless url.present?

    # Match patterns like:
    # https://github.com/owner/repo/pull/123
    # https://github.com/owner/repo/issues/123
    match = url.match(%r{github\.com/([^/]+)/([^/]+)/(pull|issues)/(\d+)})
    return nil unless match

    {
      owner: match[1],
      repo: match[2],
      type: match[3] == "pull" ? :pr : :issue,
      number: match[4].to_i,
    }
  end

  private
    def get(path)
      uri = URI("#{GITHUB_API_BASE}#{path}")
      request = Net::HTTP::Get.new(uri)
      request["Accept"] = "application/vnd.github+json"
      request["User-Agent"] = "Flexile-App"
      request["Authorization"] = "Bearer #{access_token}" if access_token.present?

      response = Net::HTTP.start(uri.hostname, uri.port, use_ssl: true) do |http|
        http.request(request)
      end

      return nil unless response.is_a?(Net::HTTPSuccess)

      JSON.parse(response.body)
    rescue JSON::ParserError, Net::HTTPError, Timeout::Error => e
      Rails.logger.error("GitHub API error: #{e.message}")
      nil
    end

    # Extract bounty amount from PR/issue labels
    # Looks for patterns like: "$100", "bounty:100", "bounty: $100", "💎 Bounty $100"
    def extract_bounty_from_labels(labels)
      return nil unless labels.is_a?(Array)

      labels.each do |label|
        name = label["name"].to_s

        # Match patterns like "$100", "$1,000", "$1000"
        if (match = name.match(/\$(\d+(?:,\d{3})*(?:\.\d{2})?)/))
          return (match[1].delete(",").to_f * 100).to_i
        end

        # Match patterns like "bounty:100" or "bounty: 100"
        if (match = name.match(/bounty[:\s]*(\d+)/i))
          return match[1].to_i * 100
        end
      end

      nil
    end
end
