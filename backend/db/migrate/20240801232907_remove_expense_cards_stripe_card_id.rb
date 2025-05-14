class RemoveExpenseCardsStripeCardId < ActiveRecord::Migration[7.1]
  def change
    remove_column :expense_cards, :stripe_card_id, :string
  end
end
