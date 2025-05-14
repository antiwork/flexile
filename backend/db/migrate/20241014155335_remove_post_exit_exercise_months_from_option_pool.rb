class RemovePostExitExerciseMonthsFromOptionPool < ActiveRecord::Migration[7.2]
  def up
    remove_column :option_pools, :post_exit_exercise_months
  end

  def down
    raise ActiveRecord::IrreversibleMigration
  end
end
