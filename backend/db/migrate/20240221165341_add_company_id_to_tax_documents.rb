class AddCompanyIdToTaxDocuments < ActiveRecord::Migration[7.1]
  def change
    add_reference :tax_documents, :company, index: true
  end
end
