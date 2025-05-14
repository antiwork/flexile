class CreateOptionPools < ActiveRecord::Migration[7.0]
  def change
    create_table :option_pools do |t|
      t.references :company, null: false
      t.string :name, null: false
      t.bigint :authorized_shares, null: false
      t.bigint :issued_shares, null: false
      t.virtual :available_shares, type: :bigint, as: "authorized_shares - issued_shares", stored: true

      t.timestamps
    end
  end
end
