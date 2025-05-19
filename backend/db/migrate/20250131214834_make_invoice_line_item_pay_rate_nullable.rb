class MakeInvoiceLineItemPayRateNullable < ActiveRecord::Migration[7.2]
  def change
    change_column_null :invoice_line_items, :pay_rate_in_subunits, true
  end
end
