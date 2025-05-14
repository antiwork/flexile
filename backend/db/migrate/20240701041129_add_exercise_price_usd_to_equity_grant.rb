class AddExercisePriceUsdToEquityGrant < ActiveRecord::Migration[7.1]
  def up
    add_column :equity_grants, :exercise_price_usd, :decimal

    EquityGrant.reset_column_information
    EquityGrant.update_all("exercise_price_usd = exercise_price_in_cents / 100.0")

    change_column_null :equity_grants, :exercise_price_usd, false
    change_column_null :equity_grants, :exercise_price_in_cents, true
  end

  def down
    EquityGrant.update_all("exercise_price_in_cents = (exercise_price_usd * 100)::bigint")
    change_column_null :equity_grants, :exercise_price_in_cents, false

    remove_column :equity_grants, :exercise_price_usd
  end
end
