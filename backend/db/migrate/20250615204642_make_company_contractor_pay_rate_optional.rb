class MakeCompanyContractorPayRateOptional < ActiveRecord::Migration[8.0]
  def change
    change_column_null :company_contractors, :pay_rate_in_subunits, false
    remove_column :company_contractors, :hours_per_week, :integer
    add_column :company_contractors, :unit_of_work, :string, default: "hour"
    up_only do
      execute "UPDATE company_contractors SET unit_of_work = 'custom' WHERE pay_rate_type = 1"
    end
    remove_column :company_contractors, :pay_rate_type, :integer, default: 0, null: false
    change_column_null :company_contractors, :unit_of_work, false
  end
end
