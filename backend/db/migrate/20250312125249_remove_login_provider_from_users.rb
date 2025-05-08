class RemoveLoginProviderFromUsers < ActiveRecord::Migration[8.0]
  def change
    remove_column :users, :login_provider, :string
  end
end
