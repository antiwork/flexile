class ChangeInvoiceLineItemsQuantityToDecimal < ActiveRecord::Migration[7.0]
  def up
    change_column :invoice_line_items, :quantity, :decimal, precision: 10, scale: 2, using: 'quantity::decimal'
  end

  def down
    change_column :invoice_line_items, :quantity, :integer, using: 'quantity::integer'
  end
end
