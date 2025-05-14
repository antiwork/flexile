class CreateCompanyInvestors < ActiveRecord::Migration[7.0]
  def change
    create_table :company_investors do |t|
      t.references :user, null: false
      t.references :company, null: false

      t.timestamps

      t.index [ :user_id, :company_id ], unique: true
    end
  end
end
