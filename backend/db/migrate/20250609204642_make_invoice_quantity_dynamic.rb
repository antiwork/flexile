class MakeInvoiceQuantityDynamic < ActiveRecord::Migration[8.0]
  def up
    remove_column :invoices, :total_minutes, :integer
    add_column :invoice_line_items, :hourly, :boolean, default: false
    up_only do
      execute "UPDATE invoice_line_items SET hourly = true WHERE minutes IS NOT NULL"
      execute "UPDATE invoice_line_items SET minutes = 1, pay_rate_in_subunits = COALESCE(total_amount_cents, 0), hourly = false WHERE minutes IS NULL"
    end
    change_table :invoice_line_items do |t|
      t.rename :minutes, :quantity
      t.change_null :hourly, false
      t.change_null :quantity, false
      t.change_null :pay_rate_in_subunits, false
    end
    remove_column :invoice_line_items, :total_amount_cents, :bigint
  end

  def down
      raise ActiveRecord::IrreversibleMigration
    end
end
