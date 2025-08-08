class AddInvestmentAmountToDividends < ActiveRecord::Migration[8.0]
  def change
    add_column :dividends, :investment_amount_in_cents, :bigint
  end
end
