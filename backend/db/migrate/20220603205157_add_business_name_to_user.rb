class AddBusinessNameToUser < ActiveRecord::Migration[7.0]
  def up
    add_column :users, :business_name, :string
  end

  def down
    remove_column :users, :business_name
  end
end
