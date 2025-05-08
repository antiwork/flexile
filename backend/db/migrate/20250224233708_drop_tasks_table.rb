class DropTasksTable < ActiveRecord::Migration[7.2]
  def change
    if reverting?
      change_column_default :tasks, :created_at, from: -> { "CURRENT_TIMESTAMP" }, to: nil
    end
    remove_reference :company_contractor_update_tasks, :task, index: true, null: false, foreign_key: false
    drop_table :tasks do |t|
      t.text "name"
      t.references :company_contractor, index: true
      t.datetime "completed_at"
      t.timestamps
    end
  end
end
