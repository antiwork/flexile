class AddActiveExerciseIdToEquityGrant < ActiveRecord::Migration[7.1]
  def change
    add_column :equity_grants, :active_exercise_id, :bigint
  end
end
