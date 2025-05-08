class CreateFinancingRounds < ActiveRecord::Migration[7.1]
  def change
    create_table :financing_rounds do |t|
      t.string :external_id, null: false, index: { unique: true }
      t.references :company, null: false, index: true
      t.string :name, null: false
      t.datetime :issued_at, null: false
      t.bigint :shares_issued, null: false
      t.bigint :price_per_share_cents, null: false
      t.bigint :amount_raised_cents, null: false
      t.bigint :post_money_valuation_cents, null: false
      t.jsonb :investors, null: false, default: []
      t.string :status, null: false

      t.timestamps
    end
  end
end
