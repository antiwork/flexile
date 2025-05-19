class MakeInvoiceNumberNotNull < ActiveRecord::Migration[7.0]
  def change
    change_column_null :consolidated_invoices, :invoice_number, false
  end
end
