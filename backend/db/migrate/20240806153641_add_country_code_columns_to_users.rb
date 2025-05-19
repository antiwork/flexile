class AddCountryCodeColumnsToUsers < ActiveRecord::Migration[7.1]
  def change
    change_table :users do |t|
      t.string :country_code
      t.string :citizenship_country_code
    end
  end
end
