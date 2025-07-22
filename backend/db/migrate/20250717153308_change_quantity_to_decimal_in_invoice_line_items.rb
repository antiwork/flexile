class ChangeQuantityToDecimalInInvoiceLineItems < ActiveRecord::Migration[8.0]
  def change
    change_column :invoice_line_items, :quantity, :decimal, precision: 10, scale: 2, null: false
  end
end