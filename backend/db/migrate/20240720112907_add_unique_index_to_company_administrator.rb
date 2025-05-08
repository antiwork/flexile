class AddUniqueIndexToCompanyAdministrator < ActiveRecord::Migration[7.1]
  def change
    add_index :company_administrators, [:user_id, :company_id], unique: true
  end
end
