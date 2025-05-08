class AddFinancingRoundsEnabledToCompanies < ActiveRecord::Migration[7.2]
  def change
    add_column :companies, :financing_rounds_enabled, :boolean, default: false, null: false

    Company.reset_column_information
    Company.find_each do |company|
      company.update!(financing_rounds_enabled: Flipper.enabled?(:financing_rounds, company))
    end
  end
end
