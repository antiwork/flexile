class CreateDividendComputations < ActiveRecord::Migration[7.0]
  def change
    create_table :dividend_computations do |t|
      t.references :company, null: false, index: true
      t.decimal :total_amount_in_usd, null: false

      t.timestamps
    end
  end
end
