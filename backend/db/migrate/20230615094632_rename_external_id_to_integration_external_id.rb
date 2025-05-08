class RenameExternalIdToIntegrationExternalId < ActiveRecord::Migration[7.0]
  def change
    rename_column :integration_records, :external_id, :integration_external_id
  end
end
