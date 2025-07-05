class MakeCompanyContractorPayRateOptional < ActiveRecord::Migration[8.0]
  def change
    change_column_null :company_contractors, :pay_rate_in_subunits, true
    remove_column :company_contractors, :hours_per_week, :integer
  end
end
