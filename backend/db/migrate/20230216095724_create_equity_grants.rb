class CreateEquityGrants < ActiveRecord::Migration[7.0]
  def change
    create_table :equity_grants do |t|
      t.references :company_contractor, null: false, index: true
      t.string :name, null: false
      t.datetime :period_started_at, null: false
      t.datetime :period_ended_at, null: false
      t.integer :number_of_shares, null: false
      t.bigint :share_price_in_cents, null: false
      t.bigint :exercise_price_in_cents, null: false
      t.virtual :total_amount_in_cents, type: :bigint, as: "number_of_shares * share_price_in_cents", stored: true
      t.datetime :exercised_at

      t.timestamps
    end
  end
end
