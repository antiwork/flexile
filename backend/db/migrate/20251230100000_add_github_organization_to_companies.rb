class AddGithubOrganizationToCompanies < ActiveRecord::Migration[8.0]
  def change
    add_column :companies, :github_organization, :string
    add_index :companies, :github_organization, unique: true
  end
end