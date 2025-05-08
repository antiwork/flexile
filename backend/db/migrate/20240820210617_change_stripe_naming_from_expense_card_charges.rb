class ChangeStripeNamingFromExpenseCardCharges < ActiveRecord::Migration[7.1]
  def change
    add_column :expense_card_charges, :processor_transaction_reference, :string
    add_column :expense_card_charges, :processor_transaction_data, :jsonb
    change_column_null :expense_card_charges, :stripe_transaction_id, true
    change_column_null :expense_card_charges, :stripe_transaction_data, true

    up_only do
      ExpenseCardCharge.reset_column_information
      ExpenseCardCharge.find_each do |expense_card_charge|
        expense_card_charge.update!(
          processor_transaction_reference: expense_card_charge.stripe_transaction_id,
          processor_transaction_data: expense_card_charge.stripe_transaction_data)
      end
    end

    change_column_null :expense_card_charges, :processor_transaction_reference, false
    change_column_null :expense_card_charges, :processor_transaction_data, false
    add_index :expense_card_charges, :processor_transaction_reference, unique: true
  end
end
