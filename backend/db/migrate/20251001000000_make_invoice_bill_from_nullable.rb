class MakeInvoiceBillFromNullable < ActiveRecord::Migration[8.0]
  def change
    change_column_null :invoices, :bill_from, true
  end
end
