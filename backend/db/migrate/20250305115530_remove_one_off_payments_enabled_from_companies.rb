class RemoveOneOffPaymentsEnabledFromCompanies < ActiveRecord::Migration[8.0]
  def change
    remove_column :companies, :one_off_payments_enabled
  end
end
