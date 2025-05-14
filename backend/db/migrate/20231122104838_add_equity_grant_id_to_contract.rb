class AddEquityGrantIdToContract < ActiveRecord::Migration[7.1]
  def change
    add_reference :contracts, :equity_grant
  end
end
