class AddExercisePeriodToOptionPool < ActiveRecord::Migration[7.0]
  def up
    add_column :option_pools, :post_exit_exercise_months, :integer

    OptionPool.reset_column_information
    OptionPool.update_all(post_exit_exercise_months: 10 * 12) # 10 years

    change_column_null :option_pools, :post_exit_exercise_months, false
  end

  def down
    remove_column :option_pools, :post_exit_exercise_months
  end
end
