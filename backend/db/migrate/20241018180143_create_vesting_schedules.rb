class CreateVestingSchedules < ActiveRecord::Migration[7.2]
  def change
    create_table :vesting_schedules do |t|
      t.string :external_id, null: false, index: { unique: true }
      t.integer :total_vesting_duration_months, null: false
      t.integer :cliff_duration_months, null: false
      t.integer :vesting_frequency_months, null: false
      t.timestamps
    end

    add_index :vesting_schedules, [:total_vesting_duration_months, :cliff_duration_months, :vesting_frequency_months], name: "idx_vesting_schedule_option", unique: true
  end
end
