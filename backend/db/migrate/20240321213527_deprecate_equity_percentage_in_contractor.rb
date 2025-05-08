class DeprecateEquityPercentageInContractor < ActiveRecord::Migration[7.1]
  def change
    rename_column :company_contractors, :equity_percentage, :deprecated_equity_percentage
  end
end
