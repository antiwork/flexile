class RemoveJsonDataFromCompanies < ActiveRecord::Migration[8.0]
  def change
    remove_column :companies, :json_data, :jsonb
  end
end
