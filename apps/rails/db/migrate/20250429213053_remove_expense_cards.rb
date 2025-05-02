class RemoveExpenseCards < ActiveRecord::Migration[8.0]
  def change
    drop_table :expense_cards
    drop_table :expense_card_charges
    drop_enum :expense_cards_processors
    remove_column :companies, :expense_cards_enabled
    remove_column :company_roles, :expense_card_spending_limit_cents
    remove_column :company_roles, :expense_card_enabled
  end
end
