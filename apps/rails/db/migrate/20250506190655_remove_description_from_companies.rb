class RemoveDescriptionFromCompanies < ActiveRecord::Migration[8.0]
  def change
    remove_column :companies, :description
    remove_column :companies, :show_stats_in_job_descriptions
  end
end
