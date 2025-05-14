class AddUsedForInvoicesAndDividends < ActiveRecord::Migration[7.0]
  def up
    change_table :wise_recipients do |t|
      t.boolean :used_for_invoices, default: false, null: false
      t.boolean :used_for_dividends, default: false, null: false
      t.index [:user_id, :used_for_invoices], unique: true, where: "user_id is not null and deleted_at is null and used_for_invoices is true"
      t.index [:user_id, :used_for_dividends], unique: true, where: "user_id is not null and deleted_at is null and used_for_dividends is true"
    end

    # Set used_for_invoices and used_for_dividends to true for all existing ContractorWiseRecipients.
    # In production, all users have only one live wise_recipient, so we can just update all records;
    # however we also want to handle the case where this migration is rolled-back and a user has several live ContractorWiseRecipients, which would break the uniqueness constraint.
    ContractorWiseRecipient.alive.select('distinct on (user_id) *').each do |wise_recipient|
      wise_recipient.update!(used_for_invoices: true, used_for_dividends: true)
    end
  end

  def down
    change_table :wise_recipients do |t|
      t.remove :used_for_invoices
      t.remove :used_for_dividends
    end
  end
end
