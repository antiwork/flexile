class RenamedExpiredSharesToForfeitedShares < ActiveRecord::Migration[7.1]
  def change
    rename_column :equity_grants, :expired_shares, :forfeited_shares
  end
end
