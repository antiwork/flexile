class AddShareHoldingToEquityGrantExerciseRequests < ActiveRecord::Migration[7.2]
  def up
    add_reference :equity_grant_exercise_requests, :share_holding

    execute <<~SQL
      UPDATE equity_grant_exercise_requests
      SET share_holding_id = equity_grant_exercises.share_holding_id
      FROM equity_grant_exercises
      WHERE equity_grant_exercise_requests.equity_grant_exercise_id = equity_grant_exercises.id
    SQL
  end

  def down
    raise ActiveRecord::IrreversibleMigration
  end
end
