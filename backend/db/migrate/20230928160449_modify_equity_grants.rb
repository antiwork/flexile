class ModifyEquityGrants < ActiveRecord::Migration[7.0]
  def change
    change_column_null :equity_grants, :option_pool_id, false
  end
end
