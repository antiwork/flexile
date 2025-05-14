class AddExternalIdToInvoice < ActiveRecord::Migration[7.1]
  def change
    add_column :invoices, :external_id, :string
  end
end
