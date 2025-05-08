class RemoveSentAtFromPayments < ActiveRecord::Migration[7.0]
  def change
    remove_column :payments, :sent_at, :datetime
  end
end
