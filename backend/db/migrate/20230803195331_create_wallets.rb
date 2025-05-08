class CreateWallets < ActiveRecord::Migration[7.0]
  def change
    create_table :wallets do |t|
      t.references :user, null: false, index: true
      t.string :wallet_address, null: false
      t.datetime :deleted_at

      t.timestamps
    end
  end
end
