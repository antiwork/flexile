class ChangeBoardApprovalDateToNullableInEquityGrants < ActiveRecord::Migration[8.0]
  def change
    change_column_null :equity_grants, :board_approval_date, true
  end
end
