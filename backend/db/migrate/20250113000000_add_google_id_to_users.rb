class AddGoogleIdToUsers < ActiveRecord::Migration[8.0]
  def change
    add_column :users, :google_id, :string
    add_index :users, :google_id
  end
end