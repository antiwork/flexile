class MakeConvertibleInvestmentIdNotNullable < ActiveRecord::Migration[7.0]
  def change
    change_column_null :convertible_securities, :convertible_investment_id, false
  end
end
