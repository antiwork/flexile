class AddDividendRoundIdToDividendComputations < ActiveRecord::Migration[7.0]
  def change
    add_column :dividend_computations, :dividend_round_id, :bigint
    add_index :dividend_computations, :dividend_round_id
    add_foreign_key :dividend_computations, :dividend_rounds
  end
end
