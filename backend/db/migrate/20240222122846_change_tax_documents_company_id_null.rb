class ChangeTaxDocumentsCompanyIdNull < ActiveRecord::Migration[7.1]
  def change
    change_column_null :tax_documents, :company_id, false
  end
end
