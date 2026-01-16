# frozen_string_literal: true

class AddInstallationIdToCompanyGithubConnections < ActiveRecord::Migration[8.0]
  def change
    add_column :company_github_connections, :installation_id, :string
    add_index :company_github_connections, :installation_id
  end
end
