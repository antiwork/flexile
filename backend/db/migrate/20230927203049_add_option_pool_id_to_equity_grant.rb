class AddOptionPoolIdToEquityGrant < ActiveRecord::Migration[7.0]
  def change
    add_reference :equity_grants, :option_pool
  end
end
