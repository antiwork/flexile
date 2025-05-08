class AddCompanyIdToEquityGrantExercise < ActiveRecord::Migration[7.1]
  def change
    add_reference :equity_grant_exercises, :company, null: false
  end
end
