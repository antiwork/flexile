class RemoveSentAtFromDividendPayments < ActiveRecord::Migration[7.0]
  def change
    remove_column :dividend_payments, :sent_at, :datetime
  end
end
