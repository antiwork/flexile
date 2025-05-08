class AddInvoiceNumberToConsolidatedInvoices < ActiveRecord::Migration[7.0]
  def change
    add_column :consolidated_invoices, :invoice_number, :string, index: true
  end
end
