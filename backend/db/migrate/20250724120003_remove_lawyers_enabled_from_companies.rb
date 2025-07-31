class RemoveLawyersEnabledFromCompanies < ActiveRecord::Migration[7.0]
  def change
    remove_column :companies, :lawyers_enabled, :boolean
  end
end