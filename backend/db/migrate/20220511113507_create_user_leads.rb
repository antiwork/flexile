class CreateUserLeads < ActiveRecord::Migration[7.0]
  def change
    create_table :user_leads do |t|
      t.string :email, null: false, index: { unique: true }

      t.timestamps
    end
  end
end
