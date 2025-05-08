class DropDailyTasks < ActiveRecord::Migration[7.2]
  def up
    drop_table :daily_tasks
  end

  def down
    create_table :daily_tasks do |t|
      t.date :date
      t.integer :seconds
      t.references :task, index: true
      t.references :invoice
      t.timestamps
    end
    add_index :daily_tasks, [:task_id, :date], unique: true
    change_column_default :daily_tasks, :created_at, from: nil, to: -> { 'CURRENT_TIMESTAMP' }
  end
end
