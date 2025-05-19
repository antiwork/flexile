class CreateDividendPayment < ActiveRecord::Migration[7.0]
  def change
    create_table :dividend_payments do |t|
      t.references :dividend, null: false
      t.string "status", null: false
      t.string "gumroad_user_id"
      t.datetime "sent_at"
      t.string "processor_uuid"
      t.string "wise_quote_id"
      t.string "wise_transfer_id"
      t.string "wise_transfer_status"
      t.decimal "wise_transfer_amount"
      t.string "wise_transfer_currency"
      t.datetime "wise_transfer_estimate"
      t.string "recipient_last4"
      t.decimal "conversion_rate"

      t.timestamps
    end
  end
end
