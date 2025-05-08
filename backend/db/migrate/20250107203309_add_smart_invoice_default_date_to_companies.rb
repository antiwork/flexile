class AddSmartInvoiceDefaultDateToCompanies < ActiveRecord::Migration[7.2]
  def change
    add_column :companies, :smart_invoice_default_date_enabled, :boolean, null: false, default: false

    up_only do
      Company.reset_column_information
      Company.find_each do |company|
        company.update_column(:smart_invoice_default_date_enabled, Flipper.enabled?(:smart_invoice_default_date, company))
      end
    end
  end
end
