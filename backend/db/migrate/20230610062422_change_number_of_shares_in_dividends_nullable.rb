class ChangeNumberOfSharesInDividendsNullable < ActiveRecord::Migration[7.0]
  def change
    change_column_null :dividends, :number_of_shares, true
  end
end
