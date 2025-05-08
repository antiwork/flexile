class CreateEquityGrantExerciseRequests < ActiveRecord::Migration[7.2]
  def up
    create_table :equity_grant_exercise_requests do |t|
      t.references :equity_grant, null: false
      t.references :equity_grant_exercise, null: false
      t.integer :number_of_options, null: false
      t.decimal :exercise_price_usd, null: false

      t.timestamps
    end

    EquityGrantExercise.reset_column_information
    EquityGrantExercise.all.each do |exercise|
      equity_grant_exercise_request = EquityGrantExerciseRequest.new(
        equity_grant_id: exercise.equity_grant_id,
        equity_grant_exercise_id: exercise.id,
        number_of_options: exercise.number_of_options,
        exercise_price_usd: exercise.exercise_price_usd,
      )
      equity_grant_exercise_request.save(validate: false)
    end

    remove_reference :equity_grant_exercises, :equity_grant
    remove_column :equity_grant_exercises, :exercise_price_usd
  end

  def down
    raise ActiveRecord::IrreversibleMigration
  end
end
