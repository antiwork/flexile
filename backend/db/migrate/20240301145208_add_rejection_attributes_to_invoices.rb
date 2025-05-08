class AddRejectionAttributesToInvoices < ActiveRecord::Migration[7.1]
  def change
    add_reference :invoices, :rejected_by, foreign_key: { to_table: :users }  
    add_column :invoices, :rejection_reason, :string
  end
end
