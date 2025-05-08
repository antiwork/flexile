class AddWithholdingPercentageToDividendPayments < ActiveRecord::Migration[7.0]
  def change
    add_column :dividend_payments, :withholding_percentage, :integer, null: false
  end
end
