class AddEquityGrantIdToInvoices < ActiveRecord::Migration[7.1]
  def change
    add_column :invoices, :equity_grant_id, :bigint
    add_index :invoices, :equity_grant_id
  end
end
