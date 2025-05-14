class ChangeCompanyRoleApplicationsCountryCodeNull < ActiveRecord::Migration[7.1]
  def change
    change_column_null :company_role_applications, :country_code, false
  end
end
