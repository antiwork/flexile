class MakeCompanyRoleRateTrialPayRateUsdRequired < ActiveRecord::Migration[7.1]
  def change
    up_only do
      CompanyRoleRate.where(trial_pay_rate_usd: nil).find_each do |rate|
        trial_pay_rate_usd = rate.pay_rate_usd / 2
        rate.update_columns(trial_pay_rate_usd:)
      end
    end

    change_column_null :company_role_rates, :trial_pay_rate_usd, false
  end
end
