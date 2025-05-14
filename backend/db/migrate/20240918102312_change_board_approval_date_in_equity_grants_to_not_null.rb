class ChangeBoardApprovalDateInEquityGrantsToNotNull < ActiveRecord::Migration[7.2]
  def change
    up_only do
      EquityGrant.where(board_approval_date: nil).find_each { _1.update!(board_approval_date: _1.issued_at) }
    end

    change_column_null :equity_grants, :board_approval_date, false
  end
end
