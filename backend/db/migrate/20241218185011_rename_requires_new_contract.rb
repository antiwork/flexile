class RenameRequiresNewContract < ActiveRecord::Migration[7.2]
  def change
    rename_column :users, :requires_new_contract, :has_confirmed_personal_details
  end
end
