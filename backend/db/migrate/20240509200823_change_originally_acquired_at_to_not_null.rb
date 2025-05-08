class ChangeOriginallyAcquiredAtToNotNull < ActiveRecord::Migration[7.1]
  def change
    change_column_null :share_holdings, :originally_acquired_at, false
  end
end
