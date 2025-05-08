class CreateTimeEntries < ActiveRecord::Migration[7.0]
  def change
    create_table :time_entries do |t|
      t.references :user, null: false, index: true
      t.references :company, null: false, index: true
      t.string :description, null: false
      t.integer :minutes
      t.date :date, null: false
      t.datetime :invoiced_at

      t.timestamps
    end
  end
end
