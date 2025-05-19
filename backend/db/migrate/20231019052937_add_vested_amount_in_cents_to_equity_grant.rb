class AddVestedAmountInCentsToEquityGrant < ActiveRecord::Migration[7.1]
  def change
    add_column :equity_grants, :vested_amount_in_cents, :bigint,
               as: "(vested_shares * share_price_in_cents)", stored: true
  end
end
