# frozen_string_literal: true

class Webhooks::GithubController < ApplicationController
  skip_before_action :verify_authenticity_token

  PR_UPDATE_ACTIONS = %w[
    opened closed reopened edited labeled unlabeled
    converted_to_draft ready_for_review
  ].freeze

  ISSUE_UPDATE_ACTIONS = %w[labeled unlabeled].freeze

  def create
    return head :unauthorized unless verify_signature(request.raw_post, request.env["HTTP_X_HUB_SIGNATURE_256"])

    event = JSON.parse(request.raw_post)
    event_type = request.env["HTTP_X_GITHUB_EVENT"]

    case event_type
    when "pull_request", "pull_request_target" then handle_pull_request_event(event)
    when "issues" then handle_issue_event(event)
    when "installation" then handle_installation_event(event)
    end

    head :ok
  rescue JSON::ParserError
    head :bad_request
  rescue StandardError => e
    Rails.logger.error "[GitHub Webhook] #{e.class}: #{e.message}"
    head :internal_server_error
  end

  private
    def verify_signature(payload, signature)
      secret = GlobalConfig.get("GH_WEBHOOK_SECRET")
      return !Rails.env.production? if secret.blank?
      return false if signature.blank?

      expected = "sha256=#{OpenSSL::HMAC.hexdigest('sha256', secret, payload)}"
      ActiveSupport::SecurityUtils.secure_compare(expected, signature)
    end

    def handle_pull_request_event(event)
      pr = event["pull_request"]
      return unless pr

      action = event["action"]
      pr_url = pr["html_url"]

      return clear_pr_data(pr_url) if action == "deleted"
      return unless PR_UPDATE_ACTIONS.include?(action)

      update_pr_line_items(
        pr_url: pr_url,
        pr: pr,
        fetch_bounty: action == "edited" && event.dig("changes", "body").present?
      )
    end

    def handle_issue_event(event)
      return unless ISSUE_UPDATE_ACTIONS.include?(event["action"])
      return unless event["issue"]

      refresh_repo_bounties(event.dig("repository", "full_name"))
    end

    def handle_installation_event(event)
      return unless %w[deleted suspend].include?(event["action"])

      account = event.dig("installation", "account", "login")
      Company.where(github_org_name: account).update_all(github_org_name: nil, github_org_id: nil)
    end

    def update_pr_line_items(pr_url:, pr:, fetch_bounty: false)
      line_items = InvoiceLineItem.where(github_pr_url: pr_url)
      return if line_items.none?

      bounty = GithubService.extract_bounty_from_labels(pr["labels"])
      bounty = fetch_pr_bounty(pr_url) || bounty if bounty.nil? || fetch_bounty

      line_items.update_all(
        github_pr_title: pr["title"],
        github_pr_state: GithubService.pr_state(pr),
        github_pr_author: pr.dig("user", "login"),
        github_pr_bounty_cents: bounty
      )
    end

    def fetch_pr_bounty(pr_url)
      line_item = InvoiceLineItem.where(github_pr_url: pr_url).includes(invoice: :company).first
      return unless line_item

      org_name = line_item.invoice.company&.github_org_name
      return unless org_name

      pr_details = GithubService.fetch_pr_details_from_url_with_app(org_name: org_name, url: pr_url)
      pr_details&.dig(:bounty_cents)
    rescue GithubService::ApiError
      nil
    end

    def clear_pr_data(pr_url)
      InvoiceLineItem.where(github_pr_url: pr_url).update_all(
        github_pr_url: nil,
        github_pr_number: nil,
        github_pr_title: nil,
        github_pr_state: nil,
        github_pr_author: nil,
        github_pr_repo: nil,
        github_pr_bounty_cents: nil
      )
    end

    def refresh_repo_bounties(repo_name)
      line_items = InvoiceLineItem
        .where(github_pr_repo: repo_name)
        .where.not(github_pr_url: nil)
        .includes(invoice: :company)

      return if line_items.none?

      line_items.find_each do |item|
        org_name = item.invoice.company&.github_org_name
        next unless org_name

        pr = GithubService.fetch_pr_details_from_url_with_app(org_name: org_name, url: item.github_pr_url)
        next unless pr && pr[:bounty_cents] != item.github_pr_bounty_cents

        item.update!(
          github_pr_bounty_cents: pr[:bounty_cents],
          github_pr_title: pr[:title],
          github_pr_state: pr[:state]
        )
      rescue GithubService::ApiError
        next
      end
    end
end
