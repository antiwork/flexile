class AddExpenseCardSpendingLimitCentsToCompanyRoles < ActiveRecord::Migration[7.1]
  def change
    add_column :company_roles, :expense_card_spending_limit_cents, :bigint, default: 0
  end
end
