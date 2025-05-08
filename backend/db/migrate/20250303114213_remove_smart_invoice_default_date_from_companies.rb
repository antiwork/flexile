class RemoveSmartInvoiceDefaultDateFromCompanies < ActiveRecord::Migration[8.0]
  def change
    remove_column :companies, :smart_invoice_default_date_enabled
  end
end
