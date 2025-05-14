class MakeOptionHolderNameNotNull < ActiveRecord::Migration[7.1]
  def change
    change_column_null :equity_grants, :option_holder_name, false
  end
end
