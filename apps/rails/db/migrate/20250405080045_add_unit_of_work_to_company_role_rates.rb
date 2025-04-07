class AddUnitOfWorkToCompanyRoleRates < ActiveRecord::Migration[7.1]
  def change
    add_column :company_role_rates, :unit_of_work, :string, default: "project"
    change_column_null :company_role_rates, :trial_pay_rate_in_subunits, true
  end
end
