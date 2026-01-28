class AddGithubToUsers < ActiveRecord::Migration[8.0]
  def change
    add_column :users, :github_uid, :string
    add_column :users, :github_username, :string
    add_index :users, :github_username, unique: true
  end
end
