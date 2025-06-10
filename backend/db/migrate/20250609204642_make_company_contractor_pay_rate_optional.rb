class MakeCompanyContractorPayRateOptional < ActiveRecord::Migration[8.0]
  def change
    change_column_null :company_contractors, :pay_rate_in_subunits, true
    change_column_null :company_contractors, :pay_rate_currency, true
    add_column :company_contractors, :unit_of_work, :string
    remove_column :company_contractors, :hours_per_week, :integer
  end
end
