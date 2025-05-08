class CreateInvestorDividendRounds < ActiveRecord::Migration[7.0]
  def change
    create_table :investor_dividend_rounds do |t|
      t.references :company_investor, null: false
      t.references :dividend_round, null: false
      t.bigint :flags, default: 0, null: false

      t.timestamps

      t.index [:company_investor_id, :dividend_round_id],
              name: :index_investor_dividend_round_uniqueness,
              unique: true
    end
  end
end
