class AddExercisePriceUsdToEquityGrantExercise < ActiveRecord::Migration[7.1]
  def up
    add_column :equity_grant_exercises, :exercise_price_usd, :decimal

    EquityGrantExercise.reset_column_information
    EquityGrantExercise.update_all("exercise_price_usd = exercise_price_cents / 100.0")

    change_column_null :equity_grant_exercises, :exercise_price_usd, false
    change_column_null :equity_grant_exercises, :exercise_price_cents, true
  end

  def down
    EquityGrantExercise.update_all("exercise_price_cents = (exercise_price_usd * 100)::bigint")
    change_column_null :equity_grant_exercises, :exercise_price_cents, false

    remove_column :equity_grant_exercises, :exercise_price_usd
  end
end
