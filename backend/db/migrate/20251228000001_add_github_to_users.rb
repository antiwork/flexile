# frozen_string_literal: true

class AddGithubToUsers < ActiveRecord::Migration[7.2]
  def change
    add_column :users, :github_uid, :string
    add_column :users, :github_username, :string
    add_column :users, :github_access_token, :string

    add_index :users, :github_uid, unique: true
  end
end
