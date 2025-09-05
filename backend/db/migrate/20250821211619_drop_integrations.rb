class DropIntegrations < ActiveRecord::Migration[8.0]
  def up
    drop_table :integrations
    execute <<-SQL
      DROP TYPE integration_status;
    SQL
  end

  def down
    create_enum :integration_status, %w[initialized active out_of_sync deleted]

    create_table :integrations do |t|
      t.references :company, null: false, index: true
      t.string :type, null: false
      t.enum :status, enum_type: :integration_status, null: false, default: "initialized"
      t.jsonb :configuration
      t.text :sync_error
      t.datetime :last_sync_at
      t.datetime :deleted_at
      t.datetime :created_at, default: -> { "CURRENT_TIMESTAMP" }, null: false
      t.datetime :updated_at, null: false
      t.string :account_id, null: false
    end

    add_index :integrations, [:company_id, :type], unique: true, where: "deleted_at IS NULL", name: "unique_active_integration_types"
    add_index :integrations, [:company_id], name: "index_integrations_on_company_id"
  end
end
