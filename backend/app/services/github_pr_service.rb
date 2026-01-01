# frozen_string_literal: true

class GithubPrService
  PR_URL_REGEX = %r{https://github\.com/([^/]+)/([^/]+)/pull/(\d+)}i

  def initialize(line_item)
    @line_item = line_item
  end

  def process_pr_link
    return unless @line_item.github_pr_url.present?

    match = @line_item.github_pr_url.match(PR_URL_REGEX)
    return unless match

    owner, repo, number = match.captures
    pr_data = fetch_pr_data(owner, repo, number.to_i)
    return unless pr_data

    @line_item.update!(github_pr_data: pr_data)
  end

  def pr_data
    @line_item.github_pr_data
  end

  def merged?
    pr_data&.dig("merged")
  end

  def bounty_label
    labels = pr_data&.dig("labels") || []
    bounty_label = labels.find { |label| label["name"]&.match?(/bounty/i) }
    bounty_label&.dig("name")
  end

  def issue_bounty_label
    return nil unless pr_data

    issue_number = pr_data.dig("body")&.match(/#(\d+)/)&.captures&.first
    return nil unless issue_number

    issue_data = fetch_issue_data(pr_data["head"]["repo"]["owner"]["login"], pr_data["head"]["repo"]["name"], issue_number.to_i)
    return nil unless issue_data

    labels = issue_data&.dig("labels") || []
    bounty_label = labels.find { |label| label["name"]&.match?(/bounty/i) }
    bounty_label&.dig("name")
  end

  def bounty_amount
    label = bounty_label || issue_bounty_label
    return nil unless label

    # Extract amount from label like "bounty: $500" or "bounty-$1000"
    amount_match = label.match(/[\$]?(\d+(?:,\d{3})*(?:\.\d{2})?)/)
    amount_match&.captures&.first&.gsub(",", "")&.to_f
  end

  def belongs_to_company_org?(company)
    return false unless pr_data && company.github_organization

    pr_data.dig("head", "repo", "owner", "login") == company.github_organization
  end

  private

  def fetch_pr_data(owner, repo, number)
    # Try to get access token from the user who created the invoice
    user = @line_item.invoice.user
    access_token = user.github_connection&.access_token

    service = GithubService.new(access_token)
    service.fetch_pr(owner, repo, number)
  end

  def fetch_issue_data(owner, repo, number)
    user = @line_item.invoice.user
    access_token = user.github_connection&.access_token

    service = GithubService.new(access_token)
    service.fetch_issue(owner, repo, number)
  end
end