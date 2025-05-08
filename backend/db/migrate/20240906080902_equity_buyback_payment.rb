class EquityBuybackPayment < ActiveRecord::Migration[7.2]
  def change
    create_table "equity_buyback_payments" do |t|
      t.string :status, null: false
      t.string :processor_uuid
      t.string :wise_quote_id
      t.string :transfer_id
      t.string :transfer_status
      t.decimal :transfer_amount
      t.string :transfer_currency
      t.datetime :wise_transfer_estimate
      t.string :recipient_last4
      t.decimal :conversion_rate
      t.bigint :total_transaction_cents
      t.bigint :wise_credential_id
      t.bigint :transfer_fee_cents
      t.string :processor_name, null: false
      t.bigint :wise_recipient_id

      t.timestamps
    end
  end
end
