class AddDocusealEnabledToCompanies < ActiveRecord::Migration[7.2]
  def change
    add_column :companies, :docuseal_enabled, :boolean, default: false, null: false
  end
end
