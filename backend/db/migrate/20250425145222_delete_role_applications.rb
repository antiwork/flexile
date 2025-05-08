class DeleteRoleApplications < ActiveRecord::Migration[8.0]
  def change
    drop_table :company_role_applications do |t|
      t.references :company_role, index: true, null: false
      t.string "name", null: false
      t.string "email", null: false
      t.text "description", null: false
      t.integer "hours_per_week"
      t.integer "weeks_per_year"
      t.integer "equity_percent", default: 0, null: false
      t.datetime "deleted_at"
      t.datetime "created_at", default: -> { "CURRENT_TIMESTAMP" }, null: false
      t.datetime "updated_at", null: false
      t.integer "status", default: 0, null: false
      t.string "country_code", null: false
    end
    remove_column :company_roles, :actively_hiring, :boolean, default: false, null: false
  end
end
