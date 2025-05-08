class AddExternalIdToOptionPool < ActiveRecord::Migration[7.2]
  def change
    add_column :option_pools, :external_id, :string
  end
end
