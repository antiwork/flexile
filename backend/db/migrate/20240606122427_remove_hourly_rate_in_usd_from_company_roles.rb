class RemoveHourlyRateInUsdFromCompanyRoles < ActiveRecord::Migration[7.1]
  def change
    remove_column :company_roles, :hourly_rate_in_usd, :integer
  end
end
