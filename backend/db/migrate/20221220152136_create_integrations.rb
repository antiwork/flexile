class CreateIntegrations < ActiveRecord::Migration[7.0]
  def up
    create_enum :integration_status, %w[initialized active out_of_sync deleted]

    create_table :integrations do |t|
      t.references :company, null: false, index: true
      t.string :type, null: false
      t.enum :status, enum_type: :integration_status, null: false, default: "initialized"
      t.jsonb :configuration
      t.text :sync_error
      t.datetime :last_sync_at
      t.datetime :deleted_at

      t.timestamps
    end

    add_index :integrations, [:company_id, :type], unique: true, where: "deleted_at IS NULL", name: "unique_active_integration_types"
  end

  def down
    drop_table :integrations

    execute <<-SQL
      DROP TYPE integration_status;
    SQL
  end
end
