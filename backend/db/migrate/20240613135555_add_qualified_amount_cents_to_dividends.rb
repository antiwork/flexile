class AddQualifiedAmountCentsToDividends < ActiveRecord::Migration[7.1]
  def change
    add_column :dividends, :qualified_amount_cents, :bigint
  end
end
