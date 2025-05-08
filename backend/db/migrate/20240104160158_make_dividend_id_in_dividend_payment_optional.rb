class MakeDividendIdInDividendPaymentOptional < ActiveRecord::Migration[7.1]
  def change
    change_column_null :dividend_payments, :dividend_id, true
  end
end
