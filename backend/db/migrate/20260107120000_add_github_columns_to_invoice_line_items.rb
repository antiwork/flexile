class AddGithubColumnsToInvoiceLineItems < ActiveRecord::Migration[7.1]
  def change
    add_column :invoice_line_items, :github_pr_url, :string
    add_column :invoice_line_items, :github_pr_number, :integer
    add_column :invoice_line_items, :github_pr_title, :string
    add_column :invoice_line_items, :github_pr_state, :string
    add_column :invoice_line_items, :github_pr_author, :string
    add_column :invoice_line_items, :github_pr_repo, :string
    add_column :invoice_line_items, :github_pr_bounty_cents, :integer
  end
end
