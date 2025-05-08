class AddFlagsToIntegrationRecords < ActiveRecord::Migration[7.1]
  def change
    add_column :integration_records, :flags, :bigint, default: 0, null: false
  end
end
