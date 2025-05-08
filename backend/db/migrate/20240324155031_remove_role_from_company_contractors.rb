class RemoveRoleFromCompanyContractors < ActiveRecord::Migration[7.1]
  def change
    remove_column :company_contractors, :role, :string
  end
end
