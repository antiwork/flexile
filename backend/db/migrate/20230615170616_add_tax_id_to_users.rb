class AddTaxIdToUsers < ActiveRecord::Migration[7.0]
  def change
    add_column :users, :tax_id, :string
  end
end
