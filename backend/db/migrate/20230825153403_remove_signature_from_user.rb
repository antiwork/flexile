class RemoveSignatureFromUser < ActiveRecord::Migration[7.0]
  def change
    remove_column :users, :signature, :string
  end
end
