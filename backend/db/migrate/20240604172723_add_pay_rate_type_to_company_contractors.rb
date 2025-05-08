class AddPayRateTypeToCompanyContractors < ActiveRecord::Migration[7.1]
  def change
    add_column :company_contractors, :pay_rate_type, :integer, null: false, default: 0
  end
end
