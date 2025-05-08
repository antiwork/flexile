class AddInvoiceNumberToInvoices < ActiveRecord::Migration[7.0]
  def change
    add_column :invoices, :invoice_number, :string, null: false, index: true
  end
end
