class AddExpenseAccountIdToRoles < ActiveRecord::Migration[7.1]
  def change
    add_column :company_roles, :expense_account_id, :string
  end
end
