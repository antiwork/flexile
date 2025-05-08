class ChangeExpenseCardsSpendingLimitCentsNull < ActiveRecord::Migration[7.1]
  def change
    change_column_null :company_roles, :expense_card_spending_limit_cents, false
  end
end
