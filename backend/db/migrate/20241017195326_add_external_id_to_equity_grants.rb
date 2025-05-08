class AddExternalIdToEquityGrants < ActiveRecord::Migration[7.2]
  def change
    add_column :equity_grants, :external_id, :string
  end
end
