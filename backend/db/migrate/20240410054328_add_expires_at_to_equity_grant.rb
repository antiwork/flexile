class AddExpiresAtToEquityGrant < ActiveRecord::Migration[7.1]
  def up
    add_column :equity_grants, :expires_at, :datetime

    EquityGrant.reset_column_information
    EquityGrant.update_all("expires_at = issued_at + INTERVAL '120 months'")

    change_column_null :equity_grants, :expires_at, false
  end

  def down
    remove_column :equity_grants, :expires_at
  end
end
