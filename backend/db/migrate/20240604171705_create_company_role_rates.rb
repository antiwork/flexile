class CreateCompanyRoleRates < ActiveRecord::Migration[7.1]
  def change
    create_table :company_role_rates do |t|
      t.integer :pay_rate_type, null: false, default: 0
      t.integer :pay_rate_usd, null: false
      t.references :company_role, null: false

      t.timestamps
    end
  end
end
