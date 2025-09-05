class DropIntegrationRecords < ActiveRecord::Migration[8.0]
  def up
    drop_table :integration_records
  end

  def down
    create_table :integration_records do |t|
      t.references :integration, null: false, index: true
      t.references :integratable, polymorphic: true
      t.string :integration_external_id, null: false
      t.string :sync_token
      t.datetime :created_at, default: -> { "CURRENT_TIMESTAMP" }, null: false
      t.datetime :updated_at, null: false
      t.datetime :deleted_at
      t.jsonb :json_data
      t.boolean :quickbooks_journal_entry, default: false, null: false
    end

    add_index :integration_records, [:integratable_type, :integratable_id], name: "index_integration_records_on_integratable"
    add_index :integration_records, [:integration_id], name: "index_integration_records_on_integration_id"
  end
end
