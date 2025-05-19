class AddIssuedAtToEquityGrant < ActiveRecord::Migration[7.1]
  def change
    add_column :equity_grants, :issued_at, :datetime
  end
end
