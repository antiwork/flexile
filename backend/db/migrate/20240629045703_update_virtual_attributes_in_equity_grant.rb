class UpdateVirtualAttributesInEquityGrant < ActiveRecord::Migration[7.1]
  def up
    change_table :equity_grants, bulk: true do |t|
      t.virtual "total_amount_usd", type: :decimal, as: "(number_of_shares * share_price_usd)", stored: true
      t.virtual "vested_amount_usd", type: :decimal, as: "(vested_shares * share_price_usd)", stored: true

      t.remove :total_amount_in_cents
      t.remove :vested_amount_in_cents
    end
  end

  def down
    change_table :equity_grants, bulk: true do |t|
      t.virtual "total_amount_in_cents", type: :bigint, as: "(number_of_shares * share_price_in_cents)", stored: true
      t.virtual "vested_amount_in_cents", type: :bigint, as: "(vested_shares * share_price_in_cents)", stored: true

      t.remove :total_amount_usd
      t.remove :vested_amount_usd
    end
  end
end
