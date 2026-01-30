class AddIndexToInvoiceLineItemsGithubPrUrl < ActiveRecord::Migration[8.0]
  def change
    add_index :invoice_line_items, :github_pr_url, where: "github_pr_url IS NOT NULL"
  end
end
