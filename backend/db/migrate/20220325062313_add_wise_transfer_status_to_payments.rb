class AddWiseTransferStatusToPayments < ActiveRecord::Migration[7.0]
  def change
    add_column :payments, :wise_transfer_status, :string
  end
end
