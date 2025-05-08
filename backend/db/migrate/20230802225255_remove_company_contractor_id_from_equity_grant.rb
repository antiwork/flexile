class RemoveCompanyContractorIdFromEquityGrant < ActiveRecord::Migration[7.0]
  def change
    remove_reference :equity_grants, :company_contractor, index: true
  end
end
