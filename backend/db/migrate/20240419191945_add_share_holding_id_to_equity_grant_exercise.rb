class AddShareHoldingIdToEquityGrantExercise < ActiveRecord::Migration[7.1]
  def change
    add_reference :equity_grant_exercises, :share_holding
  end
end
