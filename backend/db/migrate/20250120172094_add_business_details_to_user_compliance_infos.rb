class AddBusinessDetailsToUserComplianceInfos < ActiveRecord::Migration[7.2]
  def change
    add_column :user_compliance_infos, :business_type, :integer
    add_column :user_compliance_infos, :tax_classification, :integer
  end
end
