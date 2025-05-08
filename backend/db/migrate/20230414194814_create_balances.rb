class CreateBalances < ActiveRecord::Migration[7.0]
  def change
    create_table :balances do |t|
      t.references :company, null: false, index: true
      t.bigint :amount_cents, null: false, default: 0

      t.timestamps
    end
  end
end
