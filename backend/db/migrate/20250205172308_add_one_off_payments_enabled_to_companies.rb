class AddOneOffPaymentsEnabledToCompanies < ActiveRecord::Migration[7.2]
  def change
    add_column :companies, :one_off_payments_enabled, :boolean, default: false, null: false
  end
end
