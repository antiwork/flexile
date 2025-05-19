class AddConvertibleInvestmentIdToConvertibleSecurity < ActiveRecord::Migration[7.0]
  def change
    add_reference :convertible_securities, :convertible_investment, index: true
  end
end
