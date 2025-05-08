class RemoveColumnTaxIdNumberFromUsers < ActiveRecord::Migration[7.0]
  def change
    remove_column :users, :tax_id_number, :string
  end
end
