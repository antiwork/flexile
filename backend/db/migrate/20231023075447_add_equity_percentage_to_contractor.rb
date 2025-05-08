class AddEquityPercentageToContractor < ActiveRecord::Migration[7.1]
  def change
    add_column :company_contractors, :equity_percentage, :integer
  end
end
