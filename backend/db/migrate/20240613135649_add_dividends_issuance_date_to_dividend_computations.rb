class AddDividendsIssuanceDateToDividendComputations < ActiveRecord::Migration[7.1]
  def change
    add_column :dividend_computations, :dividends_issuance_date, :date
  end
end
