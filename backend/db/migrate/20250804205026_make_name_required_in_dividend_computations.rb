class MakeNameRequiredInDividendComputations < ActiveRecord::Migration[8.0]
  def change
    # First, update any existing records with null names to have a default value
    execute "UPDATE dividend_computations SET name = 'Distribution' WHERE name IS NULL"

    # Then make the column NOT NULL
    change_column_null :dividend_computations, :name, false
  end
end
