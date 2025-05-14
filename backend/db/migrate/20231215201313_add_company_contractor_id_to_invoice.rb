class AddCompanyContractorIdToInvoice < ActiveRecord::Migration[7.1]
  def change
    add_reference :invoices, :company_contractor
  end
end
