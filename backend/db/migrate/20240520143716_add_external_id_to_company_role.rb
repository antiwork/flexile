class AddExternalIdToCompanyRole < ActiveRecord::Migration[7.1]
  def change
    add_column :company_roles, :external_id, :string
  end
end
