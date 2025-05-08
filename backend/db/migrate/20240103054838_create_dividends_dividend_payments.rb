class CreateDividendsDividendPayments < ActiveRecord::Migration[7.1]
  def change
    create_table :dividends_dividend_payments, id: false do |t|
      t.belongs_to :dividend, null: false
      t.belongs_to :dividend_payment, null: false

      t.timestamps
    end
  end
end
