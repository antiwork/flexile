class AddTaxCentsToDividendPayment < ActiveRecord::Migration[7.0]
  def change
    add_column :dividend_payments, :withheld_tax_cents, :bigint, null: false
  end
end
