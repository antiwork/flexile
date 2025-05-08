class RemoveAmountCentsFromConsolidatedPayment < ActiveRecord::Migration[7.0]
  def change
    remove_column :consolidated_payments, :amount_cents, :bigint, null: false
  end
end
