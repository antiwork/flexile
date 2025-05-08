class CreateCompanyLawyers < ActiveRecord::Migration[7.1]
  def change
    create_table :company_lawyers do |t|
      t.references :user, null: false
      t.references :company, null: false
      t.string :external_id

      t.timestamps
    end

    add_index :company_lawyers, :external_id, unique: true
    add_index :company_lawyers, [:user_id, :company_id], unique: true
  end
end
