class AddUserComplianceInfoIdToDividends < ActiveRecord::Migration[7.1]
  def change
    add_reference :dividends, :user_compliance_info
  end
end
