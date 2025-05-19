class AddBoardApprovalDateToEquityGrants < ActiveRecord::Migration[7.2]
  def change
    add_column :equity_grants, :board_approval_date, :date
  end
end
