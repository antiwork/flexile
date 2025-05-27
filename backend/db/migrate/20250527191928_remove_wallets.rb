class RemoveWallets < ActiveRecord::Migration[8.0]
  def change
    drop_table :wallets
  end
end
