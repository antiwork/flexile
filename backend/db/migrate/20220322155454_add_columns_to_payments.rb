class AddColumnsToPayments < ActiveRecord::Migration[7.0]
  def change
    add_column :payments, :processor_uuid, :string
    add_column :payments, :wise_quote_id, :string
    add_column :payments, :wise_transfer_id, :string
  end
end
