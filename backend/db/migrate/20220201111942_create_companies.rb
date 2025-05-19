class CreateCompanies < ActiveRecord::Migration[7.0]
  def change
    create_table :companies do |t|
      t.string "name", null: false
      t.string "email", null: false
      t.string "registration_number", null: false
      t.string "street_address", null: false
      t.string "city", null: false
      t.string "state", null: false
      t.string "zip_code", null: false
      t.string "country", null: false

      t.timestamps
    end
  end
end
