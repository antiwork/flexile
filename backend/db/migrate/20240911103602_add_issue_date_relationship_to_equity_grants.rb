class AddIssueDateRelationshipToEquityGrants < ActiveRecord::Migration[7.2]
  def change
    create_enum :equity_grants_issue_date_relationship, %w[employee consultant investor founder officer executive board_member]
    add_column :equity_grants, :issue_date_relationship, :enum, enum_type: :equity_grants_issue_date_relationship,  null: false, default: "consultant"
  end
end
