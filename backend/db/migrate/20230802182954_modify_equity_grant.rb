class ModifyEquityGrant < ActiveRecord::Migration[7.0]
  def change
    change_column_null :equity_grants, :company_contractor_id, true
    change_column_null :equity_grants, :company_investor_id, false
  end
end
