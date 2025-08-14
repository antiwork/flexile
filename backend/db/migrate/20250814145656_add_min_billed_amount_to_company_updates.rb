class AddMinBilledAmountToCompanyUpdates < ActiveRecord::Migration[8.0]
  def change
    add_column :company_updates, :min_billed_amount, :decimal
  end
end
