class AddWithheldTaxColumnsToDividends < ActiveRecord::Migration[7.1]
  def change
    change_table :dividends do |t|
      t.bigint :withheld_tax_cents
      t.bigint :net_amount_in_cents
      t.integer :withholding_percentage
    end
  end
end
