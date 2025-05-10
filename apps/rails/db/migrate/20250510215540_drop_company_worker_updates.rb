class DropCompanyWorkerUpdates < ActiveRecord::Migration[8.0]
  def change
    drop_table :company_contractor_updates  do |t|
      t.references :company_contractor, null: false
      t.references :company, null: false
      t.date :period_starts_on, null: false
      t.date :period_ends_on, null: false
      t.datetime :published_at
      t.datetime :deleted_at
      t.datetime :created_at, default: -> { "CURRENT_TIMESTAMP" }, null: false
      t.datetime :updated_at, null: false
      t.index ["company_contractor_id", "period_starts_on"], name: "index_company_contractor_updates_on_contractor_and_period", unique: true
    end
    drop_table :company_contractor_update_tasks  do |t|
      t.references :company_contractor_update, null: false
      t.integer :position, null: false
      t.datetime :created_at, default: -> { "CURRENT_TIMESTAMP" }, null: false
      t.datetime :updated_at, null: false
      t.text :name, null: false
      t.datetime :completed_at
    end
    drop_table :company_contractor_absences  do |t|
      t.references :company_contractor, null: false
      t.references :company, null: false
      t.date :starts_on, null: false
      t.date :ends_on, null: false
      t.text :notes
      t.datetime :created_at, default: -> { "CURRENT_TIMESTAMP" }, null: false
      t.datetime :updated_at, null: false
    end
    remove_column :companies, :team_updates_enabled, :boolean, default: false, null: false
  end
end
