class RemoveWiseAttributesFromConsolidatedPayments < ActiveRecord::Migration[7.1]
  def up
    change_table :consolidated_payments, bulk: true do |t|
      t.remove :type
      t.remove :processor_uuid
      t.remove :wise_quote_id
      t.remove :wise_transfer_id
      t.remove :wise_transfer_status
      t.remove :wise_transfer_amount
      t.remove :wise_transfer_estimate
      t.remove :wise_credential_id
      t.remove :wise_recipient_id
    end
  end

  def down
    change_table :consolidated_payments, bulk: true do |t|
      t.string :type, null: false
      t.string :processor_uuid
      t.string :wise_quote_id
      t.string :wise_transfer_id
      t.string :wise_transfer_status
      t.decimal :wise_transfer_amount
      t.datetime :wise_transfer_estimate
      t.references :wise_credential
      t.references :wise_recipient
    end
  end
end
