class DropContractsTable < ActiveRecord::Migration[8.0]
  def up
    drop_table :contracts, if_exists: true
  end

  def down
    create_table :contracts do |t|
      t.datetime :signed_at
      t.bigint :company_contractor_id
      t.bigint :company_administrator_id, null: false
      t.datetime :created_at, default: -> { "CURRENT_TIMESTAMP" }, null: false
      t.datetime :updated_at, null: false
      t.string :contractor_signature
      t.string :administrator_signature, null: false
      t.string :name, null: false
      t.bigint :equity_grant_id
      t.jsonb :json_data
      t.bigint :company_id, null: false
      t.bigint :user_id, null: false
      t.boolean :equity_options_plan, default: false, null: false
      t.boolean :certificate, default: false, null: false
    end

    add_index :contracts, :company_administrator_id
    add_index :contracts, :company_contractor_id
    add_index :contracts, :company_id
    add_index :contracts, :equity_grant_id
    add_index :contracts, :user_id
  end
end