class CreateExpenseCards < ActiveRecord::Migration[7.1]
  def change
    create_table :expense_cards do |t|
      t.belongs_to :company_role, null: false
      t.belongs_to :company_contractor, null: false
      t.string :stripe_card_id, null: false
      t.string :card_last4, null: false
      t.string :card_exp_month, null: false
      t.string :card_exp_year, null: false
      t.string :card_brand, null: false
      t.boolean :active, null: false, default: false
      t.timestamps
    end
    add_index :expense_cards, :stripe_card_id, unique: true
  end
end
