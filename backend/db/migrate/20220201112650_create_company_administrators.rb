class CreateCompanyAdministrators < ActiveRecord::Migration[7.0]
  def change
    create_table :company_administrators do |t|
      t.references :user, null: false, index: true
      t.references :company, null: false, index: true

      t.timestamps
    end
  end
end
