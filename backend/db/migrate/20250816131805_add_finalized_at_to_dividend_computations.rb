class AddFinalizedAtToDividendComputations < ActiveRecord::Migration[8.0]
  def change
    add_column :dividend_computations, :finalized_at, :datetime
    add_index :dividend_computations, :finalized_at
  end
end
