class AddCompanyInvestorEntityToEquityGrant < ActiveRecord::Migration[7.2]
  def change
    add_reference :equity_grants, :company_investor_entity
  end
end
