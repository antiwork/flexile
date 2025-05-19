class MakeShareHolderNameNotNull < ActiveRecord::Migration[7.1]
  def change
    change_column_null :share_holdings, :share_holder_name, false
  end
end
