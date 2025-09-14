class RemoveUnusedCompanyUpdateColumns < ActiveRecord::Migration[8.0]
  def change
    remove_column :company_updates, :period, :string
    remove_column :company_updates, :period_started_on, :date
    remove_column :company_updates, :show_revenue, :boolean
    remove_column :company_updates, :show_net_income, :boolean
  end
end
