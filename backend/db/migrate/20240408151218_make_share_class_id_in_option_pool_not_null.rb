class MakeShareClassIdInOptionPoolNotNull < ActiveRecord::Migration[7.1]
  def change
    change_column_null :option_pools, :share_class_id, false
  end
end
