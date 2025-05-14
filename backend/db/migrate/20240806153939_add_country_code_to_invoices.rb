class AddCountryCodeToInvoices < ActiveRecord::Migration[7.1]
  def change
    add_column :invoices, :country_code, :string
  end
end
