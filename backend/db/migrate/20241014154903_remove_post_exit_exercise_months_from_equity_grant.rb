class RemovePostExitExerciseMonthsFromEquityGrant < ActiveRecord::Migration[7.2]
  def up
    remove_column :equity_grants, :post_exit_exercise_months
  end

  def down
    raise ActiveRecord::IrreversibleMigration
  end
end
