class MakeCompanyContractorPayRateOptional < ActiveRecord::Migration[8.0]
  def change
    change_column_null :company_contractors, :pay_rate_in_subunits, true
    add_column :company_contractors, :unit_of_work, :string
    remove_column :company_contractors, :hours_per_week, :integer
    remove_column :invoices, :total_minutes, :integer
    up_only do
      execute "UPDATE invoice_line_items SET minutes = 1, pay_rate_in_subunits = total_amount_cents WHERE minutes IS NULL"
    end
    change_table :invoice_line_items do |t|
      t.rename :minutes, :quantity
      t.boolean :hourly, default: false, null: false
      t.change_null :quantity, false
      t.change_null :pay_rate_in_subunits, false
    end
    remove_column :invoice_line_items, :total_amount_cents, :bigint
  end
end
