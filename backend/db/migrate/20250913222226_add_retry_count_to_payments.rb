class AddRetryCountToPayments < ActiveRecord::Migration[8.0]
  def change
    add_column :payments, :retry_count, :integer, default: 0
  end
end
