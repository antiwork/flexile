class AddExpenseCardsEnabledToCompanies < ActiveRecord::Migration[7.2]
  def change
    add_column :companies, :expense_cards_enabled, :boolean, default: false, null: false

    up_only do
      Company.reset_column_information
      Company.find_each do |company|
        company.update_column(:expense_cards_enabled, Flipper.enabled?(:expense_cards, company))
      end
    end
  end
end
