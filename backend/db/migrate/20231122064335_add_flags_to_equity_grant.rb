class AddFlagsToEquityGrant < ActiveRecord::Migration[7.1]
  def change
    add_column :equity_grants, :flags, :bigint, default: 0, null: false
  end
end
