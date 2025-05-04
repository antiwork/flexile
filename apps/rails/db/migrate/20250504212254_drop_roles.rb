class DropRoles < ActiveRecord::Migration[8.0]
  def change
    add_column :company_contractors, :role, :string
    up_only do
      execute "UPDATE company_contractors SET role = company_roles.name FROM company_roles WHERE company_contractors.company_role_id = company_roles.id"
    end
    change_column_null :company_contractors, :role, false
    drop_table :company_roles
    drop_table :company_role_rates
  end
end
