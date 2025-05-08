class RemovePayRateInSubunitsDefaults < ActiveRecord::Migration[7.2]
  def change
    change_column_default :company_contractors, :pay_rate_in_subunits, from: 0, to: nil
    change_column_default :company_role_rates, :pay_rate_in_subunits, from: 0, to: nil
    change_column_default :company_role_rates, :trial_pay_rate_in_subunits, from: 0, to: nil
    change_column_default :invoice_line_items, :pay_rate_in_subunits, from: 0, to: nil
  end
end
