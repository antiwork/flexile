class AddShareClassIdToOptionPool < ActiveRecord::Migration[7.1]
  def change
    add_reference :option_pools, :share_class
  end
end
