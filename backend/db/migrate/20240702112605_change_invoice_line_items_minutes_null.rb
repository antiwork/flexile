class ChangeInvoiceLineItemsMinutesNull < ActiveRecord::Migration[7.1]
  def change
    change_column_null :invoice_line_items, :minutes, true
  end
end
