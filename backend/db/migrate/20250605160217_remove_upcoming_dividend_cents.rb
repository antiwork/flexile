class RemoveUpcomingDividendCents < ActiveRecord::Migration[7.1]
  def change
    remove_column :companies, :upcoming_dividend_cents, :bigint
    remove_column :company_investors, :upcoming_dividend_cents, :bigint
    remove_column :convertible_investments, :upcoming_dividend_cents, :bigint
  end
end
