class AddOriginallyAcquiredAtToShareHolding < ActiveRecord::Migration[7.1]
  def change
    add_column :share_holdings, :originally_acquired_at, :datetime
  end
end
