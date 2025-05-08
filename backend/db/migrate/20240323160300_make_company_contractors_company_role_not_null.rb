class MakeCompanyContractorsCompanyRoleNotNull < ActiveRecord::Migration[7.1]
  def change
    change_column_null :company_contractors, :company_role_id, false
  end
end
