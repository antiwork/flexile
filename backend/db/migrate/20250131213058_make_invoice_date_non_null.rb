class MakeInvoiceDateNonNull < ActiveRecord::Migration[7.2]
  def change
    change_column_null :invoices, :invoice_date, false
  end
end
