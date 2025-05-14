class AddReturnOfCapitalToDividendRound < ActiveRecord::Migration[7.2]
  def change
    add_column :dividend_rounds, :return_of_capital, :boolean

    up_only do
      DividendRound.reset_column_information
      DividendRound.update_all(return_of_capital: false)
    end

    change_column_null :dividend_rounds, :return_of_capital, false
  end
end
