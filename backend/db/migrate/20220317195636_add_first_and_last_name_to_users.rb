class AddFirstAndLastNameToUsers < ActiveRecord::Migration[7.0]
  def change
    remove_column :users, :name, :string
    add_column :users, :first_name, :string
    add_column :users, :last_name, :string
  end
end
