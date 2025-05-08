class CreateEquityBuybacksEquityBuybackPayments < ActiveRecord::Migration[7.2]
  def change
    create_table :equity_buybacks_equity_buyback_payments do |t|
      t.belongs_to :equity_buyback, null: false
      t.belongs_to :equity_buyback_payment, null: false

      t.timestamps
    end
  end
end
