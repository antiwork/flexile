class AddTaxIdStatusToUser < ActiveRecord::Migration[7.1]
  def change
    add_column :users, :tax_id_status, :string
  end
end
