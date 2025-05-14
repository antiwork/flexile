class ChangeDividendComputationOutput < ActiveRecord::Migration[7.0]
  def change
    remove_reference :dividend_computation_outputs, :security, polymorphic: true
    add_column :dividend_computation_outputs, :investor_name, :string
    add_reference :dividend_computation_outputs, :company_investor
  end
end
