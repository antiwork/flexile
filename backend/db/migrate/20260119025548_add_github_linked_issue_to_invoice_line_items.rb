class AddGithubLinkedIssueToInvoiceLineItems < ActiveRecord::Migration[8.0]
  def change
    add_column :invoice_line_items, :github_linked_issue_number, :integer
    add_column :invoice_line_items, :github_linked_issue_repo, :string
  end
end
