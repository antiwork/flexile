class RemoveSharePriceInCentsFromShareHolding < ActiveRecord::Migration[7.1]
  def change
    remove_column :share_holdings, :share_price_in_cents, :bigint
  end
end
