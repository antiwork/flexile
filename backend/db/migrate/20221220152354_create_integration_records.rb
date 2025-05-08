class CreateIntegrationRecords < ActiveRecord::Migration[7.0]
  def change
    create_table :integration_records do |t|
      t.references :integration, null: false, index: true
      t.references :integratable, polymorphic: true
      t.string :external_id, null: false
      t.string :sync_token
      t.timestamps
    end
  end
end
