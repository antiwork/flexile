class AddUpcomingDividendCentsToCompany < ActiveRecord::Migration[7.1]
  def change
    add_column :companies, :upcoming_dividend_cents, :bigint
  end
end
