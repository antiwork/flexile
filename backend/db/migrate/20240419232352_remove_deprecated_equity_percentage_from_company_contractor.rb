class RemoveDeprecatedEquityPercentageFromCompanyContractor < ActiveRecord::Migration[7.1]
  def change
    remove_column :company_contractors, :deprecated_equity_percentage, :integer
  end
end
