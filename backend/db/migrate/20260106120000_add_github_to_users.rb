class AddGithubToUsers < ActiveRecord::Migration[8.0]
  def change
    add_column :users, :github_username, :string
    add_column :users, :github_external_id, :string
    add_index :users, :github_external_id, unique: true
  end
end
