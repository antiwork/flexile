class AddTaxIdStatusToUserComplianceInfos < ActiveRecord::Migration[7.1]
  def change
    add_column :user_compliance_infos, :tax_id_status, :string
  end
end
