class AddEquityCompensationEnabledToCompanies < ActiveRecord::Migration[7.2]
  def change
    add_column :companies, :equity_compensation_enabled, :boolean, default: false, null: false

    up_only do
      Company.reset_column_information
      Company.find_each do |company|
        company.update_column(:equity_compensation_enabled, Flipper.enabled?(:equity_compensation, company))
      end
    end
  end
end

