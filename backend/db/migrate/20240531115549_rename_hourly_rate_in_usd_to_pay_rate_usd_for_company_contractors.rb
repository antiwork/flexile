class RenameHourlyRateInUsdToPayRateUsdForCompanyContractors < ActiveRecord::Migration[7.1]
  def change
    rename_column :company_contractors, :hourly_rate_in_usd, :pay_rate_usd
  end
end
