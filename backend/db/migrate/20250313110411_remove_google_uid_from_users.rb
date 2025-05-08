class RemoveGoogleUidFromUsers < ActiveRecord::Migration[8.0]
  def change
    remove_index :users, :google_uid
    remove_column :users, :google_uid, :string
  end
end
