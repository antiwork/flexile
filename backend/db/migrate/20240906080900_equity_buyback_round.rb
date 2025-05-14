class EquityBuybackRound < ActiveRecord::Migration[7.2]
  def change
    create_table "equity_buyback_rounds" do |t|
      t.references :company, null: false
      t.references :tender_offer, null: false
      t.bigint :number_of_shares, null: false
      t.bigint :number_of_shareholders, null: false
      t.bigint :total_amount_cents, null: false
      t.string :status, null: false
      t.datetime :issued_at, null: false

      t.timestamps
    end
  end
end
