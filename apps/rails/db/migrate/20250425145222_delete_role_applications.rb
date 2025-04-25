class DeleteRoleApplications < ActiveRecord::Migration[8.0]
  def change
    drop_table :company_role_applications
    remove_column :company_roles, :actively_hiring
  end
end
