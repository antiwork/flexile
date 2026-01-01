class CreateUserGithubConnections < ActiveRecord::Migration[8.0]
  def change
    create_table :user_github_connections do |t|
      t.references :user, null: false, foreign_key: true
      t.string :github_username, null: false
      t.string :github_id, null: false
      t.string :access_token, null: false
      t.datetime :created_at, null: false, default: -> { "CURRENT_TIMESTAMP" }
      t.datetime :updated_at, null: false

      t.index [:user_id], unique: true
      t.index [:github_id], unique: true
    end
  end
end