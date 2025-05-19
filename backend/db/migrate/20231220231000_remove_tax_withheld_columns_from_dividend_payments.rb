class RemoveTaxWithheldColumnsFromDividendPayments < ActiveRecord::Migration[7.1]
  def up
    change_table :dividend_payments, bulk: true do |t|
      t.remove :withheld_tax_cents
      t.remove :withholding_percentage
      t.remove :net_amount_in_cents
    end
  end

  def down
    change_table :dividend_payments, bulk: true do |t|
      t.bigint :net_amount_in_cents
      t.bigint :withheld_tax_cents
      t.integer :withholding_percentage
    end

    DividendPayment.reset_column_information
    DividendPayment.find_each do |dividend_payment|
      dividend_payment.update!(
        net_amount_in_cents: dividend_payment.dividend.net_amount_in_cents,
        withheld_tax_cents: dividend_payment.dividend.withheld_tax_cents,
        withholding_percentage: dividend_payment.dividend.withholding_percentage,
      )
    end

    change_table :dividend_payments, bulk: true do |t|
      t.change_null :net_amount_in_cents, false
      t.change_null :withheld_tax_cents, false
      t.change_null :withholding_percentage, false
    end
  end
end
