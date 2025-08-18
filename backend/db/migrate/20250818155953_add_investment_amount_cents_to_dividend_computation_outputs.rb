class AddInvestmentAmountCentsToDividendComputationOutputs < ActiveRecord::Migration[8.0]
  def change
    add_column :dividend_computation_outputs, :investment_amount_cents, :bigint, null: false
  end
end