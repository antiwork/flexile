# frozen_string_literal: true

class AddGithubOrgToCompanies < ActiveRecord::Migration[7.2]
  def change
    add_column :companies, :github_org_id, :bigint
    add_column :companies, :github_org_login, :string

    add_index :companies, :github_org_id, unique: true
  end
end
