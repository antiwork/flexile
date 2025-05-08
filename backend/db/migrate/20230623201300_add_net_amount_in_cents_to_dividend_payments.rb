class AddNetAmountInCentsToDividendPayments < ActiveRecord::Migration[7.0]
  def change
    add_column :dividend_payments, :net_amount_in_cents, :bigint, null: false
  end
end
