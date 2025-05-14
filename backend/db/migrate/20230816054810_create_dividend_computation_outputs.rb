class CreateDividendComputationOutputs < ActiveRecord::Migration[7.0]
  def change
    create_table :dividend_computation_outputs do |t|
      t.references :dividend_computation, null: false, index: true
      t.references :security, polymorphic: true
      t.string :share_class, null: false
      t.bigint :number_of_shares, null: false
      t.decimal :hurdle_rate
      t.decimal :original_issue_price_in_usd
      t.decimal :preferred_dividend_amount_in_usd, null: false
      t.decimal :dividend_amount_in_usd, null: false
      t.decimal :total_amount_in_usd, null: false

      t.timestamps
    end
  end
end
