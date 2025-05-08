class AddExercisePeriodToEquityGrant < ActiveRecord::Migration[7.0]
  def change
    add_column :equity_grants, :post_exit_exercise_months, :integer
  end
end
