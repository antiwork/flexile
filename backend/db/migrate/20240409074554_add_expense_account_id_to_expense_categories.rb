class AddExpenseAccountIdToExpenseCategories < ActiveRecord::Migration[7.1]
  def change
    add_column :expense_categories, :expense_account_id, :string
  end
end
