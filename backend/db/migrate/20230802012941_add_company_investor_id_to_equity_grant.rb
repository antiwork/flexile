class AddCompanyInvestorIdToEquityGrant < ActiveRecord::Migration[7.0]
  def change
    add_reference :equity_grants, :company_investor
  end
end
