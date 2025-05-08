class ChangeContractorIdInInvoiceToNotNull < ActiveRecord::Migration[7.1]
  def change
    change_column_null :invoices, :company_contractor_id, false
  end
end
