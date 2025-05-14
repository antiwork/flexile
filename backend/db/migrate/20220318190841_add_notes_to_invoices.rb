class AddNotesToInvoices < ActiveRecord::Migration[7.0]
  def change
    add_column :invoices, :notes, :string
  end
end
