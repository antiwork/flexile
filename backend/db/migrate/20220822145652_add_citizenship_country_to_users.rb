class AddCitizenshipCountryToUsers < ActiveRecord::Migration[7.0]
  def change
    add_column :users, :citizenship_country, :string
  end
end
