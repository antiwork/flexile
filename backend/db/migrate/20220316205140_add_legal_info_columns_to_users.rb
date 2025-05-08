class AddLegalInfoColumnsToUsers < ActiveRecord::Migration[7.0]
  def change
    change_table :users, bulk: true do |t|
      t.date :birth_date
      t.string :tax_id_number
      t.string :street_address
      t.string :city
      t.string :zip_code
    end
  end
end
