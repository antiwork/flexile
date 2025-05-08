class AddActivelyHiringToCompanyRoles < ActiveRecord::Migration[7.0]
  def change
    remove_column :company_roles, :actively_hiring
    add_column :company_roles, :actively_hiring, :boolean, null: false, default: false
  end
end
