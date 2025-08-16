class AddInvestmentAmountToDividendComputationOutputs < ActiveRecord::Migration[8.0]
  def change
    add_column :dividend_computation_outputs, :investment_amount_in_cents, :bigint
  end
end
