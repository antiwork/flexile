class AddTeamUpdatesEnabledToCompanies < ActiveRecord::Migration[7.2]
  def change
    add_column :companies, :team_updates_enabled, :boolean, default: false, null: false

    up_only do
      Company.reset_column_information
      Company.find_each do |company|
        company.update_column(:team_updates_enabled, Flipper.enabled?(:team_updates, company))
      end
    end
  end
end
