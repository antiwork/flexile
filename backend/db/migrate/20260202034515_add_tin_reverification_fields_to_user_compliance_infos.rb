class AddTinReverificationFieldsToUserComplianceInfos < ActiveRecord::Migration[8.0]
  def change
    add_column :user_compliance_infos, :requires_tin_reverification, :boolean, default: false, null: false
  end
end
