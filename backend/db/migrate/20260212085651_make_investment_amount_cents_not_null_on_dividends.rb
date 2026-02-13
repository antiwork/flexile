class MakeInvestmentAmountCentsNotNullOnDividends < ActiveRecord::Migration[8.0]
  def up
    change_column_null :dividends, :investment_amount_cents, false
  end

  def down
    change_column_null :dividends, :investment_amount_cents, true
  end
end
