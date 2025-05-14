class AddExternalIdToCompanyAdministrators < ActiveRecord::Migration[7.2]
  def change
    add_column :company_administrators, :external_id, :string
  end
end
