# frozen_string_literal: true

class CreateCompanyGithubConnections < ActiveRecord::Migration[8.0]
  def change
    create_table :company_github_connections do |t|
      t.references :company, null: false, foreign_key: true, index: false
      t.references(
        :connected_by,
        null: false,
        foreign_key: { to_table: :users }
      )

      t.string :github_org_id, null: false
      t.string :github_org_login, null: false
      t.datetime :revoked_at

      t.timestamps
    end

    add_index :company_github_connections,
              :github_org_id,
              unique: true,
              where: "revoked_at IS NULL"

    add_index :company_github_connections,
              :company_id,
              unique: true,
              where: "revoked_at IS NULL"

  end
end
