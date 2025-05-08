class MergeCompanyWorkerUpdateTasks < ActiveRecord::Migration[7.2]
  def change
    change_table :company_contractor_update_tasks do |t|
      t.text :name
      t.datetime "completed_at"
      t.change_null :task_id, true
      t.remove_index [:company_contractor_update_id, :position], unique: true
    end
    CompanyWorkerUpdateTask.reset_column_information
    up_only do
      CompanyWorkerUpdateTask.includes(:task).find_each do |update_task|
        update_task.update!(name: update_task.task.name, completed_at: update_task.task.completed_at)
        update_task.task.integration_records.update!(integratable: update_task)
      end
    end
    change_column_null :company_contractor_update_tasks, :name, false
  end
end
