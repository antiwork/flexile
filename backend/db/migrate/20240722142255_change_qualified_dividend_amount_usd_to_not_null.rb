class ChangeQualifiedDividendAmountUsdToNotNull < ActiveRecord::Migration[7.1]
  def change
    change_column_null :dividend_computation_outputs, :qualified_dividend_amount_usd, false
  end
end
