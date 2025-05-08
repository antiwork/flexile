class CreateCompanyContractorUpdateTasks < ActiveRecord::Migration[7.2]
  def change
    create_table :company_contractor_update_tasks do |t|
      t.references :company_contractor_update, null: false
      t.references :task, null: false
      t.integer :position, null: false

      t.timestamps
    end

    add_index :company_contractor_update_tasks, [:company_contractor_update_id, :position], unique: true
  end
end
