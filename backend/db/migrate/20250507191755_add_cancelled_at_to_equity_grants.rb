class AddCancelledAtToEquityGrants < ActiveRecord::Migration[8.0]
  def change
    add_column :equity_grants, :cancelled_at, :datetime
  end
end
