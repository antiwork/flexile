class AddSharePriceUsdToEquityGrant < ActiveRecord::Migration[7.1]
  def change
    add_column :equity_grants, :share_price_usd, :decimal

    up_only do
      EquityGrant.reset_column_information
      EquityGrant.update_all("share_price_usd = share_price_in_cents / 100.0")
    end

    change_column_null :equity_grants, :share_price_usd, false
    change_column_null :equity_grants, :share_price_in_cents, true
  end
end
