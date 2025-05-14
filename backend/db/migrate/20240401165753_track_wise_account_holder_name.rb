class TrackWiseAccountHolderName < ActiveRecord::Migration[7.1]
  def change
    add_column :wise_recipients, :account_holder_name, :string
    add_reference :payments, :wise_recipient
    add_reference :dividend_payments, :wise_recipient
    add_reference :consolidated_payments, :wise_recipient
  end
end
