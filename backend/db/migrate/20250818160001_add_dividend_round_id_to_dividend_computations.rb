class AddDividendRoundIdToDividendComputations < ActiveRecord::Migration[8.0]
  def change
    add_column :dividend_computations, :dividend_round_id, :bigint
  end
end