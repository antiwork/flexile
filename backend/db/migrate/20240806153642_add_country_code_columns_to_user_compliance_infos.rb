class AddCountryCodeColumnsToUserComplianceInfos < ActiveRecord::Migration[7.1]
  def change
    change_table :user_compliance_infos do |t|
      t.string :country_code
      t.string :citizenship_country_code
    end
  end
end
