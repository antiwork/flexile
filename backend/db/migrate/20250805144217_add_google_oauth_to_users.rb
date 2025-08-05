class AddGoogleOauthToUsers < ActiveRecord::Migration[7.1]
  def change
    add_column :users, :google_uid, :string
    add_index :users, :google_uid, unique: true
  end
end
