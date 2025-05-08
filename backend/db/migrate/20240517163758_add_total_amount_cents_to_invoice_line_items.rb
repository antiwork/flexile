class AddTotalAmountCentsToInvoiceLineItems < ActiveRecord::Migration[7.1]
  def up
    add_column :invoice_line_items, :total_amount_cents, :bigint

    InvoiceLineItem.reset_column_information
    InvoiceLineItem.all.each do |line_item|
      total_amount_cents = ((line_item.hourly_rate_in_usd * 100.0) * (line_item.minutes / 60.0)).ceil
      line_item.update_column(:total_amount_cents, total_amount_cents)
    end

    change_column_null :invoice_line_items, :total_amount_cents, false
  end

  def down
    remove_column :invoice_line_items, :total_amount_cents
  end
end
