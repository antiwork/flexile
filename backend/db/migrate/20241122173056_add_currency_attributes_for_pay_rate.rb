class AddCurrencyAttributesForPayRate < ActiveRecord::Migration[7.2]
  def change
    add_column :company_contractors, :pay_rate_in_subunits, :integer, null: false, default: 0
    add_column :company_contractors, :pay_rate_currency, :string, null: false, default: "usd"

    add_column :company_role_rates, :pay_rate_in_subunits, :integer, null: false, default: 0
    add_column :company_role_rates, :pay_rate_currency, :string, null: false, default: "usd"
    add_column :company_role_rates, :trial_pay_rate_in_subunits, :integer, null: false, default: 0

    add_column :invoice_line_items, :pay_rate_in_subunits, :integer, null: false, default: 0
    add_column :invoice_line_items, :pay_rate_currency, :string, null: false, default: "usd"

    add_column :companies, :default_currency, :string, null: false, default: "usd"
  end
end
