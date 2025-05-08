class AddLawyersEnabledToCompanies < ActiveRecord::Migration[7.2]
  def change
    add_column :companies, :lawyers_enabled, :boolean

    up_only do
      Company.reset_column_information
      Company.find_each do |company|
        company.update_column(:lawyers_enabled, Flipper.enabled?(:lawyers, company))
      end
    end
  end
end
