class AddMinimumDividendPaymentInCentsToUser < ActiveRecord::Migration[7.0]
  def change
    add_column :users, :minimum_dividend_payment_in_cents, :bigint, default: 10_00, null: false
  end
end
