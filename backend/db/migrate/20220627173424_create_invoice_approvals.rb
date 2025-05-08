class CreateInvoiceApprovals < ActiveRecord::Migration[7.0]
  def change
    create_table :invoice_approvals do |t|
      t.references :invoice, null: false, index: true
      t.references :approver, null: false, index: true
      t.datetime :approved_at, null: false

      t.timestamps
    end

    add_index :invoice_approvals, [:invoice_id, :approver_id], unique: true, name: "index_approvals_on_invoice_and_approver"
    add_column :invoices, :invoice_approvals_count, :integer, default: 0, null: false, index: true
  end
end
