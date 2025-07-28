class ConsolidateEquityFlags < ActiveRecord::Migration[7.2]
  def change
    add_column :companies, :equity_enabled, :boolean, default: false, null: false

    up_only do
      Company.reset_column_information
      Company.find_each do |company|
        # Enable equity if any of the four equity-related features are enabled
        equity_enabled = company.cap_table_enabled? ||
                        company.tender_offers_enabled? ||
                        company.equity_grants_enabled? ||
                        company.equity_compensation_enabled?

        company.update_column(:equity_enabled, equity_enabled)
      end
    end

    # Remove the old columns
    remove_column :companies, :cap_table_enabled, :boolean
    remove_column :companies, :tender_offers_enabled, :boolean
    remove_column :companies, :equity_grants_enabled, :boolean
    remove_column :companies, :equity_compensation_enabled, :boolean
  end
end