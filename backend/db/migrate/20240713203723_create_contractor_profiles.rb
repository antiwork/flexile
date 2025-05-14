class CreateContractorProfiles < ActiveRecord::Migration[7.1]
  def up
    create_table :contractor_profiles do |t|
      t.references :user, null: false, index: { unique: true }
      t.text :description
      t.integer :available_hours_per_week, null: false
      t.bigint :flags, default: 0, null: false

      t.timestamps
    end
  end

  def down
    drop_table :contractor_profiles
  end
end
