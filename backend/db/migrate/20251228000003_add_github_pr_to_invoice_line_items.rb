# frozen_string_literal: true

class AddGithubPrToInvoiceLineItems < ActiveRecord::Migration[7.2]
  def change
    add_column :invoice_line_items, :github_pr_url, :string
    add_column :invoice_line_items, :github_pr_number, :integer
    add_column :invoice_line_items, :github_pr_title, :string
    add_column :invoice_line_items, :github_pr_merged_at, :datetime
    add_column :invoice_line_items, :github_pr_author, :string
    add_column :invoice_line_items, :github_pr_bounty_cents, :integer
    add_column :invoice_line_items, :github_pr_repo, :string
    add_column :invoice_line_items, :github_pr_verified, :boolean, default: false
    add_column :invoice_line_items, :github_pr_paid_at, :datetime

    add_index :invoice_line_items, :github_pr_url
  end
end
