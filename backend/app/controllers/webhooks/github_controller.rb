# frozen_string_literal: true

class Webhooks::GithubController < ApplicationController
  skip_before_action :verify_authenticity_token

  PR_UPDATE_ACTIONS = %w[
    opened
    closed
    reopened
    edited
    labeled
    unlabeled
    converted_to_draft
    ready_for_review
    synchronize
  ].freeze

  ISSUE_UPDATE_ACTIONS = %w[
    labeled
    unlabeled
  ].freeze

  def create
    payload = request.raw_post
    signature = request.env["HTTP_X_HUB_SIGNATURE_256"]
    event_type = request.env["HTTP_X_GITHUB_EVENT"]

    unless verify_signature(payload, signature)
      Rails.logger.warn "[GitHub Webhook] Invalid signature"
      head :unauthorized
      return
    end

    event = JSON.parse(payload)
    Rails.logger.info "[GitHub Webhook] Received event: #{event_type}"

    case event_type
    when "pull_request", "pull_request_target"
      handle_pull_request_event(event)
    when "issues"
      handle_issue_event(event)
    when "installation"
      handle_installation_event(event)
    when "ping"
      Rails.logger.info "[GitHub Webhook] Ping received"
    else
      Rails.logger.debug "[GitHub Webhook] Ignoring event type: #{event_type}"
    end

    head :ok
  rescue JSON::ParserError => e
    Rails.logger.error "[GitHub Webhook] Invalid JSON payload: #{e.message}"
    head :bad_request
  rescue => e
    Rails.logger.error "[GitHub Webhook] Error processing webhook: #{e.message}"
    Rails.logger.error e.backtrace.first(10).join("\n")
    head :internal_server_error
  end

  private
    def verify_signature(payload, signature)
      webhook_secret = GlobalConfig.get("GH_WEBHOOK_SECRET")

      # If no secret configured, skip verification (development only)
      if webhook_secret.blank?
        Rails.logger.warn "[GitHub Webhook] No webhook secret configured, skipping verification"
        return !Rails.env.production?
      end

      return false if signature.blank?

      expected_signature = "sha256=" + OpenSSL::HMAC.hexdigest(
        OpenSSL::Digest.new("sha256"),
        webhook_secret,
        payload
      )

      ActiveSupport::SecurityUtils.secure_compare(expected_signature, signature)
    end

    def handle_pull_request_event(event)
      action = event["action"]
      pr = event["pull_request"]

      return unless pr.present?

      pr_url = pr["html_url"]
      pr_number = pr["number"]
      repo_full_name = event.dig("repository", "full_name")

      Rails.logger.info "[GitHub Webhook] PR ##{pr_number} action: #{action} (#{repo_full_name})"

      if action == "deleted"
        handle_pr_deleted(pr_url, pr_number)
        return
      end

      return unless PR_UPDATE_ACTIONS.include?(action)

      body_changed = action == "edited" && event.dig("changes", "body").present?

      update_line_items_for_pr(pr_url, pr_number, pr, repo_full_name, fetch_linked_issues: body_changed)
    end

    def handle_issue_event(event)
      action = event["action"]
      return unless ISSUE_UPDATE_ACTIONS.include?(action)

      issue = event["issue"]
      return unless issue.present?

      issue_number = issue["number"]
      repo_full_name = event.dig("repository", "full_name")

      Rails.logger.info "[GitHub Webhook] Issue ##{issue_number} action: #{action} (#{repo_full_name})"

      refresh_pr_bounties_for_repo(repo_full_name)
    end

    def handle_installation_event(event)
      action = event["action"]
      installation = event["installation"]
      account = installation&.dig("account", "login")

      Rails.logger.info "[GitHub Webhook] Installation #{action} for #{account}"

      case action
      when "deleted", "suspend"
        company = Company.find_by(github_org_name: account)
        if company.present?
          company.update!(github_org_name: nil, github_org_id: nil)
          Rails.logger.info "[GitHub Webhook] Cleared GitHub connection for company: #{company.name}"
        end
      end
    end

    def update_line_items_for_pr(pr_url, pr_number, pr, repo_full_name, fetch_linked_issues: false)
      line_items = InvoiceLineItem.where(github_pr_url: pr_url)

      if line_items.empty?
        Rails.logger.debug "[GitHub Webhook] No invoice line items found for PR: #{pr_url}"
        return
      end

      pr_state = GithubService.pr_state(pr)
      bounty_cents = GithubService.extract_bounty_from_labels(pr["labels"])

      if bounty_cents.nil? || fetch_linked_issues
        bounty_cents = fetch_bounty_for_line_item(pr_url) || bounty_cents
      end

      updated_count = 0
      line_items.find_each do |line_item|
        line_item.update!(
          github_pr_title: pr["title"],
          github_pr_state: pr_state,
          github_pr_author: pr.dig("user", "login"),
          github_pr_bounty_cents: bounty_cents
        )
        updated_count += 1
      end

      Rails.logger.info "[GitHub Webhook] Updated #{updated_count} invoice line items for PR ##{pr_number} (bounty: #{bounty_cents || 'none'})"
    end

    def fetch_bounty_for_line_item(pr_url)
      line_item = InvoiceLineItem.where(github_pr_url: pr_url).includes(invoice: :company).first
      return nil unless line_item

      company = line_item.invoice.company
      return nil unless company&.github_org_name.present?

      begin
        pr_details = GithubService.fetch_pr_details_from_url_with_app(
          org_name: company.github_org_name,
          url: pr_url
        )
        pr_details&.dig(:bounty_cents)
      rescue GithubService::ApiError => e
        Rails.logger.warn "[GitHub Webhook] Failed to fetch bounty for #{pr_url}: #{e.message}"
        nil
      end
    end

    def handle_pr_deleted(pr_url, pr_number)
      line_items = InvoiceLineItem.where(github_pr_url: pr_url)

      if line_items.empty?
        Rails.logger.debug "[GitHub Webhook] No invoice line items found for deleted PR: #{pr_url}"
        return
      end

      updated_count = 0
      line_items.find_each do |line_item|
        line_item.update!(
          github_pr_url: nil,
          github_pr_number: nil,
          github_pr_title: nil,
          github_pr_state: nil,
          github_pr_author: nil,
          github_pr_repo: nil,
          github_pr_bounty_cents: nil
        )
        updated_count += 1
      end

      Rails.logger.info "[GitHub Webhook] Cleared PR data from #{updated_count} invoice line items for deleted PR ##{pr_number}"
    end

    def refresh_pr_bounties_for_repo(repo_full_name)
      line_items = InvoiceLineItem
        .where(github_pr_repo: repo_full_name)
        .where.not(github_pr_url: nil)
        .includes(invoice: :company)

      return if line_items.empty?

      Rails.logger.info "[GitHub Webhook] Refreshing bounties for #{line_items.count} line items in #{repo_full_name}"

      line_items.find_each do |line_item|
        company = line_item.invoice.company
        next unless company&.github_org_name.present?

        begin
          pr_details = GithubService.fetch_pr_details_from_url_with_app(
            org_name: company.github_org_name,
            url: line_item.github_pr_url
          )

          if pr_details
            old_bounty = line_item.github_pr_bounty_cents
            new_bounty = pr_details[:bounty_cents]

            if old_bounty != new_bounty
              line_item.update!(
                github_pr_bounty_cents: new_bounty,
                github_pr_title: pr_details[:title],
                github_pr_state: pr_details[:state]
              )
              Rails.logger.info "[GitHub Webhook] Updated bounty for PR ##{line_item.github_pr_number}: #{old_bounty} -> #{new_bounty}"
            end
          end
        rescue GithubService::ApiError => e
          Rails.logger.warn "[GitHub Webhook] Failed to refresh bounty for #{line_item.github_pr_url}: #{e.message}"
        end
      end
    end
end
