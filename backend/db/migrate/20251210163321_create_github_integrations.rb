# frozen_string_literal: true

class CreateGithubIntegrations < ActiveRecord::Migration[8.0]
  def change
    create_table :github_integrations do |t|
      t.references :company, null: false, foreign_key: true, index: true
      t.string :organization_name, null: false
      t.bigint :organization_id, null: false
      t.bigint :installation_id
      t.string :access_token
      t.datetime :access_token_expires_at
      t.string :refresh_token
      t.string :status, null: false, default: "active"
      t.datetime :deleted_at

      t.timestamps default: -> { "CURRENT_TIMESTAMP" }
    end

    add_index :github_integrations, :company_id,
              unique: true,
              where: "deleted_at IS NULL",
              name: "index_github_integrations_unique_active_company"
  end
end
