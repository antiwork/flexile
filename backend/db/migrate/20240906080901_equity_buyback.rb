class EquityBuyback < ActiveRecord::Migration[7.2]
  def change
    create_table "equity_buybacks" do |t|
      t.references :company, null: false
      t.references :company_investor, null: false
      t.references :equity_buyback_round, null: false
      t.bigint :total_amount_cents, null: false
      t.bigint :share_price_cents, null: false
      t.bigint :exercise_price_cents, null: false
      t.bigint :number_of_shares
      t.datetime :paid_at
      t.string :status, null: false
      t.string :retained_reason

      t.timestamps
    end
  end
end
