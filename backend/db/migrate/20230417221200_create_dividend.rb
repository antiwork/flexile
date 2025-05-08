class CreateDividend < ActiveRecord::Migration[7.0]
  def change
    create_table :dividends do |t|
      t.references :company, null: false
      t.references :dividend_round, null: false
      t.references :company_investor, null: false
      t.bigint "total_amount_in_cents", null: false
      t.bigint "number_of_shares", null: false
      t.datetime "paid_at"
      t.string "status", null: false

      t.timestamps
    end
  end
end
