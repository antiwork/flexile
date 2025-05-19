class CreateConvertibleSecurities < ActiveRecord::Migration[7.0]
  def change
    create_table :convertible_securities do |t|
      t.references :company_investor, null: false, index: true
      t.string :name, null: false
      t.string :convertible_type, null: false
      t.bigint :company_valuation_in_dollars, null: false
      t.bigint :principal_value_in_cents, null: false
      t.datetime :issued_at, null: false

      t.timestamps
    end
  end
end
