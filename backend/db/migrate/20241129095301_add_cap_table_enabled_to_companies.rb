class AddCapTableEnabledToCompanies < ActiveRecord::Migration[7.2]
  def change
    add_column :companies, :cap_table_enabled, :boolean, default: false, null: false

    Company.reset_column_information
    Company.find_each do |company|
      company.update!(cap_table_enabled: Flipper.enabled?(:cap_table, company))
    end
  end
end
