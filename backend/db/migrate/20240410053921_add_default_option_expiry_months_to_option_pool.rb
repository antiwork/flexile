class AddDefaultOptionExpiryMonthsToOptionPool < ActiveRecord::Migration[7.1]
  def change
    add_column :option_pools, :default_option_expiry_months, :integer, default: 120, null: false
  end
end
