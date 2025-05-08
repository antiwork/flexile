class DropHasConfirmedPersonalDetailsFromUsers < ActiveRecord::Migration[7.2]
  def change
    remove_column :users, :has_confirmed_personal_details, :boolean, default: false, null: false
  end
end
