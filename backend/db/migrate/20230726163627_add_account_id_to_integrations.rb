class AddAccountIdToIntegrations < ActiveRecord::Migration[7.0]
  def up
    add_column :integrations, :account_id, :string

    Integration.reset_column_information
    Integration.find_each do |integration|
      integration.update_column(:account_id, integration.configuration['account_id'])
    end

    change_column_null :integrations, :account_id, false
  end

  def down
    remove_column :integrations, :account_id
  end
end
