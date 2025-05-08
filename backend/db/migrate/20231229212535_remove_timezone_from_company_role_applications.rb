class RemoveTimezoneFromCompanyRoleApplications < ActiveRecord::Migration[7.1]
  def change
    remove_column :company_role_applications, :timezone, :string
  end
end
