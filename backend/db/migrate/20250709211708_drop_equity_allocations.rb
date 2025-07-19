class DropEquityAllocations < ActiveRecord::Migration[8.0]
  def change
    add_column :company_contractors, :equity_percentage, :integer, default: 0, null: false
    up_only do
      execute "UPDATE company_contractors SET equity_percentage = COALESCE((SELECT equity_percentage FROM equity_allocations WHERE equity_allocations.company_contractor_id = company_contractors.id ORDER BY year DESC LIMIT 1), 0)"
    end

    drop_table :equity_allocations do |t|
      t.bigint "company_contractor_id", null: false
      t.integer "equity_percentage"
      t.integer "year", null: false
      t.datetime "created_at", default: -> { "CURRENT_TIMESTAMP" }, null: false
      t.datetime "updated_at", null: false
      t.boolean "locked", default: false, null: false
      t.boolean "sent_equity_percent_selection_email", default: false, null: false
      t.enum "status", default: "pending_confirmation", null: false, enum_type: "equity_allocations_status"
      t.index ["company_contractor_id", "year"], name: "index_equity_allocations_on_company_contractor_id_and_year", unique: true
      t.index ["company_contractor_id"], name: "index_equity_allocations_on_company_contractor_id"
    end

    drop_enum :equity_allocations_status, %w[pending_confirmation pending_grant_creation pending_approval approved]
  end
end
