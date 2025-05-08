class ModifyInvoicesForEquityCompensation < ActiveRecord::Migration[7.1]
  def up
    change_table :invoices, bulk: true do |t|
      t.integer :equity_percentage
      t.bigint :equity_amount_in_cents
      t.integer :equity_amount_in_options
      t.bigint :cash_amount_in_cents
      t.bigint :flags, default: 0, null: false
    end

    Invoice.reset_column_information
    Invoice.update_all("equity_percentage = 0, equity_amount_in_cents = 0, equity_amount_in_options = 0, " \
                       "cash_amount_in_cents = total_amount_in_usd_cents")

    change_table :invoices, bulk: true do |t|
      t.change_null :equity_percentage, false
      t.change_null :equity_amount_in_cents, false
      t.change_null :equity_amount_in_options, false
      t.change_null :cash_amount_in_cents, false
    end
  end

  def down
    remove_columns :invoices,
                   :equity_percentage,
                   :equity_amount_in_cents,
                   :equity_amount_in_options,
                   :cash_amount_in_cents,
                   :flags
  end
end
