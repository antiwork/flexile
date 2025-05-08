class AddLoginProviderToUser < ActiveRecord::Migration[7.1]
  def change
    add_column :users, :login_provider, :string
  end
end
