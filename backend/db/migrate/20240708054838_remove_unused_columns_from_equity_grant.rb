class RemoveUnusedColumnsFromEquityGrant < ActiveRecord::Migration[7.1]
  def up
    change_table :equity_grants, bulk: true do |t|
      t.remove :total_amount_usd
      t.remove :share_price_in_cents
      t.remove :exercise_price_in_cents
    end
  end

  def down
    change_table :equity_grants, bulk: true do |t|
      t.virtual "total_amount_usd", type: :decimal, as: "((number_of_shares)::numeric * share_price_usd)", stored: true
      t.bigint "share_price_in_cents"
      t.bigint "exercise_price_in_cents"
    end
  end
end
