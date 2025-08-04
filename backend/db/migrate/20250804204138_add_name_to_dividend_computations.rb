class AddNameToDividendComputations < ActiveRecord::Migration[8.0]
  def change
    add_column :dividend_computations, :name, :string
  end
end
