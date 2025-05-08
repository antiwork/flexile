class AddCountryCodeToCompanyRoleApplications < ActiveRecord::Migration[7.1]
  def change
    add_column :company_role_applications, :country_code, :string
  end
end
