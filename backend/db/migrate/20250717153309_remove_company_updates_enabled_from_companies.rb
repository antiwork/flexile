class RemoveCompanyUpdatesEnabledFromCompanies < ActiveRecord::Migration[7.2]
  def change
    remove_column :companies, :company_updates_enabled, :boolean
  end
end