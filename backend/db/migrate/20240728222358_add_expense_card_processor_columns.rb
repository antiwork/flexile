class AddExpenseCardProcessorColumns < ActiveRecord::Migration[7.1]
  def change
    create_enum :expense_cards_processors, %w[stripe]
    add_column :expense_cards, :processor_reference, :string
    add_column :expense_cards, :processor, :enum, enum_type: :expense_cards_processors
    add_index :expense_cards, [:processor_reference, :processor], unique: true

    up_only do
      ExpenseCard.reset_column_information
      ExpenseCard.find_each do |expense_card|
        expense_card.update!(processor: :stripe, processor_reference: expense_card.stripe_card_id)
      end
    end

    change_column_null :expense_cards, :processor, false
    change_column_null :expense_cards, :processor_reference, false
  end
end
