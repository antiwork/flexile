class AddTrialPayRateUsdToCompanyRoleRate < ActiveRecord::Migration[7.1]
  def change
    add_column :company_role_rates, :trial_pay_rate_usd, :integer
  end
end
