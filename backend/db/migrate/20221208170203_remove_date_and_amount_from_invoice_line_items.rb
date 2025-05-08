class RemoveDateAndAmountFromInvoiceLineItems < ActiveRecord::Migration[7.0]
  def change
    remove_columns :invoice_line_items, :amount, :date
  end
end
