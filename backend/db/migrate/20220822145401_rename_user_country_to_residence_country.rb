class RenameUserCountryToResidenceCountry < ActiveRecord::Migration[7.0]
  def change
    rename_column :users, :country, :residence_country
  end
end
