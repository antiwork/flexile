class RenameInvoiceNotesToDescription < ActiveRecord::Migration[7.0]
  def change
    rename_column :invoices, :notes, :description
  end
end
