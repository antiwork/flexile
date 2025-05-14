class AddEquityExerciseBankAccountIdToEquityGrantExercise < ActiveRecord::Migration[7.1]
  def change
    add_reference :equity_grant_exercises, :equity_exercise_bank_account
  end
end
