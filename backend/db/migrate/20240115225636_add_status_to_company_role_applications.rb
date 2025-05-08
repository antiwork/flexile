class AddStatusToCompanyRoleApplications < ActiveRecord::Migration[7.1]
  def change
    add_column :company_role_applications, :status, :integer, default: 0, null: false
  end
end
