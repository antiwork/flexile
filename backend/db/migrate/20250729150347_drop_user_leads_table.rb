class DropUserLeadsTable < ActiveRecord::Migration[8.0]
  def change
    drop_table :user_leads do |t|
      t.string :email, null: false, index: { unique: true }
      t.timestamps
    end
  end
end
