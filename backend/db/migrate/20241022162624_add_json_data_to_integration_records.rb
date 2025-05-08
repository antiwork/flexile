class AddJsonDataToIntegrationRecords < ActiveRecord::Migration[7.2]
  def change
    add_column :integration_records, :json_data, :jsonb
  end
end
