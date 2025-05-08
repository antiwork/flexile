class ChangeUserResidenceCountryNull < ActiveRecord::Migration[7.0]
  def change
    change_column_null :users, :residence_country, true
  end
end
