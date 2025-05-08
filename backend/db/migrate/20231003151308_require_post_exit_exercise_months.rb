class RequirePostExitExerciseMonths < ActiveRecord::Migration[7.0]
  def change
    change_column_null :equity_grants, :post_exit_exercise_months, false
  end
end
