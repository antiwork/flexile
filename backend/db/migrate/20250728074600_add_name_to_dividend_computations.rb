class AddNameToDividendComputations < ActiveRecord::Migration[8.0]
  def change
    add_column :dividend_computations, :name, :string
    add_column :dividend_computations, :release_document, :text
  end
end
