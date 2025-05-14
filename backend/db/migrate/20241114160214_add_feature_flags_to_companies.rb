class AddFeatureFlagsToCompanies < ActiveRecord::Migration[7.2]
  def change
    change_table :companies do |t|
      t.boolean :show_analytics_to_contractors, default: false
      t.boolean :company_updates_enabled, default: false
    end
  end
end
