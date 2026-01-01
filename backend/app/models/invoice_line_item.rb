# frozen_string_literal: true

class InvoiceLineItem < ApplicationRecord
  include Serializable

  belongs_to :invoice

  validates :description, presence: true
  validates :pay_rate_in_subunits, presence: true, numericality: { only_integer: true, greater_than: 0 }
  validates :quantity, presence: true, numericality: { greater_than_or_equal_to: 0.01 }

  after_save :process_github_pr, if: :github_pr_url_changed?

  def github_pr_service
    @github_pr_service ||= GithubPrService.new(self)
  end

  def process_github_pr
    github_pr_service.process_pr_link
  end

  def pr_merged?
    github_pr_service.merged?
  end

  def pr_bounty_amount
    github_pr_service.bounty_amount
  end

  def pr_belongs_to_company_org?(company)
    github_pr_service.belongs_to_company_org?(company)
  end

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
