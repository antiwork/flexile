class RemoveTrialFieldsFromDatabase < ActiveRecord::Migration[8.0]
  def change
    remove_column :company_roles, :trial_enabled, :boolean

    remove_column :company_role_rates, :trial_pay_rate_in_subunits, :integer

    remove_column :company_contractors, :on_trial, :boolean
  end
end
