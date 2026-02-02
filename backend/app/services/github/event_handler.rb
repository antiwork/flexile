# frozen_string_literal: true

class Github::EventHandler
  PR_UPDATE_ACTIONS = %w[
    opened closed reopened edited labeled unlabeled
    converted_to_draft ready_for_review
  ].freeze

  ISSUE_UPDATE_ACTIONS = %w[labeled unlabeled].freeze

  def initialize(event, event_type)
    @event = event
    @event_type = event_type
  end

  def process!
    case event_type
    when "pull_request" then handle_pull_request_event
    when "issues" then handle_issue_event
    when "installation" then handle_installation_event
    end
  end

  private
    attr_reader :event, :event_type

    def handle_pull_request_event
      pr = event["pull_request"]
      return unless pr

      action = event["action"]
      pr_url = pr["html_url"]

      return clear_github_pr_fields_by_url(pr_url) if action == "deleted"
      return unless PR_UPDATE_ACTIONS.include?(action)

      line_items = InvoiceLineItem.where(github_pr_url: pr_url).includes(invoice: :company)
      return if line_items.none?

      line_items.each { |line_item| update_line_item_pr_details(line_item) }
    end

    def handle_issue_event
      return unless ISSUE_UPDATE_ACTIONS.include?(event["action"])

      issue = event["issue"]
      return unless issue

      issue_number = issue["number"]
      repo_name = event.dig("repository", "full_name")
      return unless issue_number && repo_name

      line_items = InvoiceLineItem.where(github_linked_issue_number: issue_number, github_linked_issue_repo: repo_name)
                                  .includes(invoice: :company)
      return if line_items.none?

      line_items.each { |line_item| update_line_item_pr_details(line_item) }
    end

    def update_line_item_pr_details(line_item)
      pr_details = GithubService.fetch_pr_details_from_url(
        org_name: line_item.invoice.company.github_org_name,
        url: line_item.github_pr_url
      )

      if pr_details
        line_item.update(
          github_pr_title: pr_details[:title],
          github_pr_state: pr_details[:state],
          github_pr_bounty_cents: pr_details[:bounty_cents],
          github_linked_issue_number: pr_details[:linked_issue_number],
          github_linked_issue_repo: pr_details[:linked_issue_repo],
        )
      end
    end

    def handle_installation_event
      return unless %w[deleted suspend].include?(event["action"])

      account = event.dig("installation", "account", "login")
      Company.where(github_org_name: account).update_all(github_org_name: nil, github_org_id: nil)
    end

    def clear_github_pr_fields_by_url(pr_url)
      InvoiceLineItem.where(github_pr_url: pr_url).update_all(
        InvoiceLineItem::GITHUB_PR_FIELDS.index_with { nil }
      )
    end
end
