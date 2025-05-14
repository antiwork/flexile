class AddFlagsToCompanyRoles < ActiveRecord::Migration[7.1]
  def change
    add_column :company_roles, :flags, :bigint, default: 0, null: false
  end
end
