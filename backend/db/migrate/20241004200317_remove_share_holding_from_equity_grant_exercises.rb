class RemoveShareHoldingFromEquityGrantExercises < ActiveRecord::Migration[7.2]
  def change
    remove_reference :equity_grant_exercises, :share_holding
  end
end
