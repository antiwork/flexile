class AddGithubOrgToCompanies < ActiveRecord::Migration[8.0]
  def change
    add_column :companies, :github_org_name, :string
    add_column :companies, :github_org_id, :bigint

    add_index :companies, :github_org_id, unique: true, where: "github_org_id IS NOT NULL"
  end
end
