class AddGumroadUserIdToUser < ActiveRecord::Migration[7.0]
  def change
    add_column :users, :gumroad_user_id, :string
  end
end
