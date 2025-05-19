class AddDeletedAtToIntegrationRecords < ActiveRecord::Migration[7.0]
  def change
    add_column :integration_records, :deleted_at, :datetime
  end
end
