class RemoveFeatureFlagsFromCompanies < ActiveRecord::Migration[7.0]
  def change
    remove_column :companies, :lawyers_enabled, :boolean
    remove_column :companies, :tender_offers_enabled, :boolean
    remove_column :companies, :company_updates_enabled, :boolean
    remove_column :companies, :cap_table_enabled, :boolean
    remove_column :companies, :equity_grants_enabled, :boolean
    remove_column :companies, :equity_compensation_enabled, :boolean
  end
end