class AddCompanyInvestorEntityToShareHolding < ActiveRecord::Migration[7.2]
  def change
    add_reference :share_holdings, :company_investor_entity
  end
end
