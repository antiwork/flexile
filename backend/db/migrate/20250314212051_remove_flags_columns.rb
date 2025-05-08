class RemoveFlagsColumns < ActiveRecord::Migration[8.0]
  def change
    remove_column :companies, :flags, :bigint
    remove_column :company_contractors, :flags, :bigint
    remove_column :company_updates, :flags, :bigint
    remove_column :contracts, :flags, :bigint
    remove_column :contractor_profiles, :flags, :bigint
    remove_column :equity_allocations, :flags, :bigint
    remove_column :company_roles, :flags, :bigint
    remove_column :company_investors, :flags, :bigint
    remove_column :integration_records, :flags, :bigint
    remove_column :equity_grants, :flags, :bigint
    remove_column :share_classes, :flags, :bigint
    remove_column :investor_dividend_rounds, :flags, :bigint
    remove_column :users, :flags, :integer
  end
end
