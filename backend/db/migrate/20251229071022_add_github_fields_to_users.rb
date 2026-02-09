class AddGithubFieldsToUsers < ActiveRecord::Migration[8.0]
  def change
    add_column :users, :github_uid, :string
    add_column :users, :github_username, :string
    add_column :users, :github_access_token, :string

    add_index :users, :github_uid, unique: true, where: "github_uid IS NOT NULL"
  end
end
