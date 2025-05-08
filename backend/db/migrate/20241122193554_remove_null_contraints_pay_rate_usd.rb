class RemoveNullContraintsPayRateUsd < ActiveRecord::Migration[7.2]
  def change
    change_column_null :company_contractors, :pay_rate_usd, true
    change_column_null :company_role_rates, :pay_rate_usd, true
    change_column_null :company_role_rates, :trial_pay_rate_usd, true
    change_column_null :invoice_line_items, :pay_rate_usd, true
  end
end
