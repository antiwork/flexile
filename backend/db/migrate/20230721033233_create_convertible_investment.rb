class CreateConvertibleInvestment < ActiveRecord::Migration[7.0]
  def change
    create_table :convertible_investments do |t|
      t.references :company, null: false, index: true
      t.bigint :company_valuation_in_dollars, null: false
      t.bigint :amount_in_cents, null: false
      t.bigint :implied_shares, null: false
      t.string :valuation_type, null: false

      t.timestamps
    end
  end
end
