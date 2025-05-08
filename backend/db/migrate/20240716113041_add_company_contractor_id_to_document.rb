class AddCompanyContractorIdToDocument < ActiveRecord::Migration[7.1]
  def change
    add_reference :documents, :company_contractor
  end
end
