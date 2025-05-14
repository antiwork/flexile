class CreateTimeTrackingTasks < ActiveRecord::Migration[7.0]
  def change
    create_table :tasks do |t|
      t.timestamps
      t.string :name
      t.references :company_contractor, index: true
    end
    create_table :daily_tasks do |t|
      t.timestamps
      t.references :task, index: true
      t.date :date
      t.integer :seconds
      t.references :invoice
    end
    add_index :daily_tasks, [:task_id, :date], unique: true
  end
end
