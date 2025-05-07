class RemoveDescriptionFromCompanies < ActiveRecord::Migration[8.0]
  def change
    remove_column :companies, :description, :text
    remove_column :companies, :show_stats_in_job_descriptions, :boolean, null: false, default: false
  end
end
