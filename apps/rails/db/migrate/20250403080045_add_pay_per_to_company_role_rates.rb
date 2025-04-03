class AddPayPerToCompanyRoleRates < ActiveRecord::Migration[7.1]
  def change
    add_column :company_role_rates, :pay_per, :string, default: "project"
    change_column_null :company_role_rates, :trial_pay_rate_in_subunits, true
  end
end
