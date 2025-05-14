class RemoveDividendIdFromDividendPayment < ActiveRecord::Migration[7.1]
  def change
    remove_reference :dividend_payments, :dividend
  end
end
