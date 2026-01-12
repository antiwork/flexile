# frozen_string_literal: true

class GithubService
  Result = Data.define(:id, :title, :state, :merged, :html_url, :number, :owner, :repo, :bounty_amount, :author, :is_paid, :is_verified, :type, :error)

  def initialize(token: nil)
    @token = token
  end

  def fetch_pull_request(url:, invoice_id: nil, company_id: nil, user: nil)
    match = url.match(%r{^https://github\.com/([^/]+)/([^/]+)/(pull|issues)/(\d+)$})
    return nil unless match

    owner, repo, type, number = match.captures
    number = number.to_i
    is_pr = type == "pull"

    # Security check for company organization
    if company_id
      company_integration = Integration.find_by(company_id: company_id, type: "GithubIntegration")
      if company_integration
        company_org = company_integration.configuration["organization"]&.downcase
        if company_org.present? && owner.downcase != company_org
          return Result.new(
            id: nil, title: nil, state: nil, merged: nil, html_url: nil, number: number, owner: owner, repo: repo,
            bounty_amount: nil, author: nil, is_paid: false, is_verified: nil, type: type,
            error: "wrong_organization"
          )
        end
      end
    end

    # Check if paid
    if invoice_id
      paid_item = InvoiceLineItem.joins(:invoice)
                                 .where(description: url)
                                 .where.not(invoice_id: invoice_id)
                                 .first
      is_paid = paid_item&.invoice&.status == "paid"
    else
      paid_item = InvoiceLineItem.joins(:invoice)
                                 .where(description: url)
                                 .first
      is_paid = paid_item&.invoice&.status == "paid"
    end

    api_url = is_pr ? "https://api.github.com/repos/#{owner}/#{repo}/pulls/#{number}" : "https://api.github.com/repos/#{owner}/#{repo}/issues/#{number}"

    response = request_github(api_url)

    if !response.success?
      if response.code == 404 || response.code == 403
        return Result.new(
          id: nil, title: nil, state: nil, merged: nil, html_url: nil, number: number, owner: owner, repo: repo,
          bounty_amount: nil, author: nil, is_paid: is_paid, is_verified: nil, type: type,
          error: "not_found_or_private"
        )
      end
      return nil
    end

    data = response.parsed_response

    # Bounty extraction
    bounty_amount = nil
    bounty_label = data["labels"]&.find { |l| l["name"].downcase.include?("bounty") }
    if bounty_label
      bounty_amount = extract_bounty_amount(bounty_label["name"])
    end

    # Fallback: Check linked issue
    if bounty_amount.nil? && is_pr && data["labels"]
      begin
        body = data["body"] || ""
        issue_match = body.match(/(?:close[sd]?|fix(?:e[sd])?|resolve[sd]?)\s+#(\d+)/i)

        if issue_match
          issue_number = issue_match[1]
          issue_url = "https://api.github.com/repos/#{owner}/#{repo}/issues/#{issue_number}"
          issue_response = request_github(issue_url)

          if issue_response.success?
            issue_data = issue_response.parsed_response
            issue_bounty_label = issue_data["labels"]&.find { |l| l["name"].downcase.include?("bounty") }
            if issue_bounty_label
              bounty_amount = extract_bounty_amount(issue_bounty_label["name"])
            end
          end
        end
      rescue StandardError => e
        Rails.logger.error("GitHub API Error (Fallback): #{e.message}")
        # Silently fail fallback
      end
    end

    # Verification
    is_verified = nil
    expected_username = nil

    if invoice_id
      invoice = Invoice.find_by(id: invoice_id)
      expected_username = invoice&.contractor&.user&.github_username
    else
      expected_username = user&.github_username
    end

    if expected_username.present?
      is_verified = data["user"]["login"].downcase == expected_username.downcase
    end

    Result.new(
      id: data["id"],
      title: data["title"],
      state: data["state"],
      merged: data["merged"] || false,
      html_url: data["html_url"],
      number: data["number"],
      owner: owner,
      repo: repo,
      bounty_amount: bounty_amount,
      author: data["user"]["login"],
      is_paid: is_paid,
      is_verified: is_verified,
      type: type,
      error: nil
    )
  end

  private
    def request_github(url)
      headers = { "Accept" => "application/vnd.github.v3+json", "User-Agent" => "Flexile" }
      headers["Authorization"] = "Bearer #{@token}" if @token.present?

      HTTParty.get(url, headers: headers)
    end

    def extract_bounty_amount(text)
      match = text.match(/\$?\s*(\d+(?:\.\d+)?)\s*([KkMm])?/)
      return nil unless match

      base_amount = match[1].to_f
      suffix = match[2]&.upcase

      amount = if suffix == "K"
        base_amount * 1000
      elsif suffix == "M"
        base_amount * 1_000_000
      else
        base_amount
      end
      amount.round
    end
end
