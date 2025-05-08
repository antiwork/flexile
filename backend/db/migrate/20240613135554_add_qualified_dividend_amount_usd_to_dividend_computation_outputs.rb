class AddQualifiedDividendAmountUsdToDividendComputationOutputs < ActiveRecord::Migration[7.1]
  def change
    add_column :dividend_computation_outputs, :qualified_dividend_amount_usd, :decimal
  end
end
