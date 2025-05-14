class RemoveFmvFromDividendRound < ActiveRecord::Migration[7.0]
  def up
    remove_column :dividend_rounds, :dividend_per_share_in_cents
  end

  def down
    add_column :dividend_rounds, :dividend_per_share_in_cents, :bigint

    DividendRound.reset_column_information
    DividendRound.update_all(dividend_per_share_in_cents: 2_58)

    change_column_null :dividend_rounds, :dividend_per_share_in_cents, false
  end
end
