class AddExternalIdToDividendComputation < ActiveRecord::Migration[7.2]
  def change
    add_column :dividend_computations, :external_id, :string
  end
end
