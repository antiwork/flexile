class AddFlagsToUsers < ActiveRecord::Migration[7.0]
  def change
    add_column :users, :flags, :integer, default: 0, null: false
  end
end
