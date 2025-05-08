class CreateEquityExerciseBankAccount < ActiveRecord::Migration[7.1]
  def change
    create_table :equity_exercise_bank_accounts do |t|
      t.references :company, null: false
      t.jsonb :details, null: false
      t.string :account_number, null: false

      t.timestamps
    end
  end
end
