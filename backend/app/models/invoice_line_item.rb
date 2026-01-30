# frozen_string_literal: true

class InvoiceLineItem < ApplicationRecord
  include Serializable

  GITHUB_PR_FIELDS = %i[
    github_pr_url
    github_pr_number
    github_pr_title
    github_pr_state
    github_pr_author
    github_pr_repo
    github_pr_bounty_cents
    github_linked_issue_number
    github_linked_issue_repo
  ].freeze

  belongs_to :invoice

  validates :description, presence: true
  validates :pay_rate_in_subunits, presence: true, numericality: { only_integer: true, greater_than: 0 }
  validates :quantity, presence: true, numericality: { greater_than_or_equal_to: 0.01 }

  def normalized_quantity
    quantity / (hourly? ? 60.0 : 1.0)
  end

  def total_amount_cents
    (pay_rate_in_subunits * normalized_quantity).ceil
  end

  def cash_amount_in_cents
    return total_amount_cents if invoice.equity_percentage.zero?

    equity_amount_in_cents = ((total_amount_cents * invoice.equity_percentage) / 100.to_d).round
    total_amount_cents - equity_amount_in_cents
  end

  def cash_amount_in_usd
    cash_amount_in_cents / 100.0
  end
end
