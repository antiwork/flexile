class AddDeletedAtToUsers < ActiveRecord::Migration[8.0]
  def change
    add_column :users, :deleted_at, :datetime
  end
end
