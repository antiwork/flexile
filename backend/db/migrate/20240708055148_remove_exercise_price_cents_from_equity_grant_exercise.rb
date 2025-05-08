class RemoveExercisePriceCentsFromEquityGrantExercise < ActiveRecord::Migration[7.1]
  def change
    remove_column :equity_grant_exercises, :exercise_price_cents, :bigint
  end
end
