class ModifyEquityBuyback < ActiveRecord::Migration[7.2]
  def change
    add_reference :equity_buybacks, :security, polymorphic: true, null: false
    add_column :equity_buybacks, :share_class, :string, null: false
  end
end
