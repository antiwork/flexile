class AddAcceptedAtToEquityGrants < ActiveRecord::Migration[7.2]
  def change
    add_column :equity_grants, :accepted_at, :datetime

    up_only do
      EquityGrant.reset_column_information

      Document.equity_plan_contract.includes(:equity_grant).where.not(completed_at: nil).find_each do |document|
        document.equity_grant&.update!(accepted_at: document.completed_at)
      end
    end
  end
end
