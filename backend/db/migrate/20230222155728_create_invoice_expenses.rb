class CreateInvoiceExpenses < ActiveRecord::Migration[7.0]
  def change
    create_table :invoice_expenses do |t|
      t.references :invoice, null: false, index: true
      t.references :expense_category, null: false
      t.bigint :total_amount_in_cents, null: false
      t.string :description, null: false

      t.timestamps
    end
  end
end
