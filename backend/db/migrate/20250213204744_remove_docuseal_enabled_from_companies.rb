class RemoveDocusealEnabledFromCompanies < ActiveRecord::Migration[7.2]
  def change
    remove_column :companies, :docuseal_enabled, :boolean
  end
end
