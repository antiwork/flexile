class AddUpcomingDividendCentsToConvertibleInvestment < ActiveRecord::Migration[7.1]
  def change
    add_column :convertible_investments, :upcoming_dividend_cents, :bigint
  end
end
