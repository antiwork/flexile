class AddPeriodToCompanyUpdates < ActiveRecord::Migration[7.1]
  def change
    change_table :company_updates, bulk: true do |t|
      t.string :period
      t.date :period_started_on
    end
  end
end
