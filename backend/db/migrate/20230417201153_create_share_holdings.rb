class CreateShareHoldings < ActiveRecord::Migration[7.0]
  def change
    create_table :share_holdings do |t|
      t.references :company_investor, null: false
      t.references :equity_grant
      t.string :name, null: false
      t.string :share_type, null: false
      t.datetime :issued_at, null: false
      t.integer :number_of_shares, null: false
      t.bigint :share_price_in_cents, null: false
      t.virtual :total_amount_in_cents, type: :bigint, as: "number_of_shares * share_price_in_cents", stored: true

      t.timestamps
    end
  end
end
