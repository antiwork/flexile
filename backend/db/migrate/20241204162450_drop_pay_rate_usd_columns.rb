class DropPayRateUsdColumns < ActiveRecord::Migration[7.2]
  def change
    remove_column :company_contractors, :pay_rate_usd, :integer
    remove_column :company_role_rates, :pay_rate_usd, :integer
    remove_column :company_role_rates, :trial_pay_rate_usd, :integer
    remove_column :invoice_line_items, :pay_rate_usd, :integer
  end
end
