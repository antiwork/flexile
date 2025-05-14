class AddCountryCodeToCompanies < ActiveRecord::Migration[7.1]
  def change
    add_column :companies, :country_code, :string
  end
end
