class CreateExpenseCategories < ActiveRecord::Migration[7.0]
  def change
    create_table :expense_categories do |t|
      t.references :company, null: false, index: true
      t.string :name, null: false

      t.timestamps
    end
  end
end
