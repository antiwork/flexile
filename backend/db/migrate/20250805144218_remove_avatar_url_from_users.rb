class RemoveAvatarUrlFromUsers < ActiveRecord::Migration[8.0]
  def change
    remove_column :users, :avatar_url, :string
  end
end
