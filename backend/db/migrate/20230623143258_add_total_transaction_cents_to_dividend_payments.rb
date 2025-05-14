class AddTotalTransactionCentsToDividendPayments < ActiveRecord::Migration[7.0]
  def change
    add_column :dividend_payments, :total_transaction_cents, :bigint
  end
end
