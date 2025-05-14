class CreateEquityGrantExercise < ActiveRecord::Migration[7.1]
  def change
    create_table :equity_grant_exercises do |t|
      t.references :equity_grant, null: false
      t.references :company_investor, null: false
      t.datetime :requested_at, null: false
      t.datetime :signed_at
      t.bigint :exercise_price_cents, null: false
      t.bigint :number_of_options, null: false
      t.bigint :total_cost_cents, null: false
      t.string :status, null: false
      t.string :bank_reference, null: false

      t.timestamps
    end
  end
end
