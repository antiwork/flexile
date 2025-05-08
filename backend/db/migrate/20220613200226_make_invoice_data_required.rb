class MakeInvoiceDataRequired < ActiveRecord::Migration[7.0]
  def change
    change_column_null :invoices, :due_on, false
    change_column_null :invoices, :bill_from, false
    change_column_null :invoices, :bill_to, false
  end
end
