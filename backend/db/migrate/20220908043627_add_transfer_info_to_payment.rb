class AddTransferInfoToPayment < ActiveRecord::Migration[7.0]
  def change
    add_column :payments, :wise_transfer_amount, :decimal
    add_column :payments, :wise_transfer_currency, :string
    add_column :payments, :wise_transfer_estimate, :datetime
    add_column :payments, :recipient_last4, :string
    add_column :payments, :conversion_rate, :decimal
  end
end
