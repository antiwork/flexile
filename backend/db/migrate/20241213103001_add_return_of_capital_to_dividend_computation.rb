class AddReturnOfCapitalToDividendComputation < ActiveRecord::Migration[7.2]
  def change
    add_column :dividend_computations, :return_of_capital, :boolean

    up_only do
      DividendComputation.reset_column_information
      DividendComputation.update_all(return_of_capital: false)
    end

    change_column_null :dividend_computations, :return_of_capital, false
  end
end
