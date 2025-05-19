class AddSignatureToUsers < ActiveRecord::Migration[7.0]
  def change
    add_column :users, :signature, :string
  end
end
