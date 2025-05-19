class AddShareHolderNameToShareHolding < ActiveRecord::Migration[7.1]
  def change
    add_column :share_holdings, :share_holder_name, :string
  end
end
