class CreateExpenseCardCharges < ActiveRecord::Migration[7.1]
  def change
    create_table :expense_card_charges do |t|
      t.belongs_to :expense_card, null: false
      t.belongs_to :company, null: false
      t.string :description, null: false
      t.bigint :total_amount_in_cents, null: false
      t.string :stripe_transaction_id, null: false
      t.jsonb :stripe_transaction_data, null: false

      t.timestamps
    end
    add_index :expense_card_charges, :stripe_transaction_id, unique: true
  end
end
