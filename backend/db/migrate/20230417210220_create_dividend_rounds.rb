class CreateDividendRounds < ActiveRecord::Migration[7.0]
  def change
    create_table :dividend_rounds do |t|
      t.references :company, null: false
      t.datetime "issued_at", null: false
      t.bigint "number_of_shares", null: false
      t.bigint "number_of_shareholders", null: false
      t.bigint "dividend_per_share_in_cents", null: false
      t.virtual "total_amount_in_cents", type: :bigint, as: "number_of_shares * dividend_per_share_in_cents",
                stored: true
      t.string "status", null: false

      t.timestamps
    end
  end
end
