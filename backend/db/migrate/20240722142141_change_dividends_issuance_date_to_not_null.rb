class ChangeDividendsIssuanceDateToNotNull < ActiveRecord::Migration[7.1]
  def change
    change_column_null :dividend_computations, :dividends_issuance_date, false
  end
end
