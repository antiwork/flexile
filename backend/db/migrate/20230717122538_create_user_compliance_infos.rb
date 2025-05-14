class CreateUserComplianceInfos < ActiveRecord::Migration[7.0]
  def change
    create_table :user_compliance_infos do |t|
      t.references :user, null: false, index: true
      t.string :legal_name
      t.date :birth_date
      t.string :tax_id
      t.string :residence_country
      t.string :citizenship_country
      t.string :street_address
      t.string :city
      t.string :state
      t.string :zip_code
      t.string :signature
      t.string :business_name
      t.datetime :tax_information_confirmed_at
      t.datetime :deleted_at
      t.integer :flags, default: 0, null: false

      t.timestamps
    end
  end
end
