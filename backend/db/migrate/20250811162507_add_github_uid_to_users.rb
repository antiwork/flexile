class AddGithubUidToUsers < ActiveRecord::Migration[8.0]
  def change
    add_column :users, :github_uid, :string
    add_index :users, :github_uid, unique: true
  end
end
