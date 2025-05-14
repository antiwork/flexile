class CreateConsolidatedPayment < ActiveRecord::Migration[7.0]
  def change
    create_table :consolidated_payments do |t|
      t.references :consolidated_invoice, null: false
      t.bigint :stripe_fee_cents
      t.bigint :amount_cents, null: false
      t.string :stripe_payment_intent_id
      t.string :stripe_transaction_id
      t.datetime :succeeded_at
      t.string :stripe_payout_id
      t.datetime :trigger_payout_after

      t.timestamps
    end
  end
end
