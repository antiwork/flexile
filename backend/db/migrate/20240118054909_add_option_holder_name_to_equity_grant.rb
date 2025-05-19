class AddOptionHolderNameToEquityGrant < ActiveRecord::Migration[7.1]
  def change
    add_column :equity_grants, :option_holder_name, :string
  end
end
