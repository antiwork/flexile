class AddDeletedAtToInvoices < ActiveRecord::Migration[8.0]
  def change
    add_column :invoices, :deleted_at, :datetime
  end
end
