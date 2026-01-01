class AddGithubPrFieldsToInvoiceLineItems < ActiveRecord::Migration[8.0]
  def change
    add_column :invoice_line_items, :github_pr_url, :string
    add_column :invoice_line_items, :github_pr_data, :jsonb
    add_index :invoice_line_items, :github_pr_url
  end
end