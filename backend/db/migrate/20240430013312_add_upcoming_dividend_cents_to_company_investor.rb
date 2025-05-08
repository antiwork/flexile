class AddUpcomingDividendCentsToCompanyInvestor < ActiveRecord::Migration[7.1]
  def change
    add_column :company_investors, :upcoming_dividend_cents, :bigint
  end
end
