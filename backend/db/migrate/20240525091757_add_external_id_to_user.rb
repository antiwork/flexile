class AddExternalIdToUser < ActiveRecord::Migration[7.1]
  def change
    add_column :users, :external_id, :string
  end
end
