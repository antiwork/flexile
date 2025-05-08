class AddTaxIdAndPhoneNumberToCompanies < ActiveRecord::Migration[7.1]
  def change
    change_table :companies do |t|
      t.string :tax_id
      t.string :phone_number
    end
  end
end
