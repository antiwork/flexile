class AddSharePriceUsdToShareHolding < ActiveRecord::Migration[7.1]
  def up
    add_column :share_holdings, :share_price_usd, :decimal

    ShareHolding.reset_column_information
    ShareHolding.update_all("share_price_usd = share_price_in_cents / 100.0")
    change_column_null :share_holdings, :share_price_usd, false

    change_column_null :share_holdings, :share_price_in_cents, true
  end

  def down
    change_column_null :share_holdings, :share_price_in_cents, false

    remove_column :share_holdings, :share_price_usd
  end
end
