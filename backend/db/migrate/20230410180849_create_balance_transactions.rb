class CreateBalanceTransactions < ActiveRecord::Migration[7.0]
  def change
    create_table :balance_transactions do |t|
      t.references :company, null: false, index: true
      t.references :consolidated_payment, index: true
      t.references :payment, index: true
      t.bigint :amount_cents, null: false
      t.string :type, null: false
      t.string :transaction_type

      t.timestamps
    end
  end
end
