class AddClerkIdToUsers < ActiveRecord::Migration[7.2]
  def change
    add_column :users, :clerk_id, :string
    add_index :users, :clerk_id, unique: true
  end
end
