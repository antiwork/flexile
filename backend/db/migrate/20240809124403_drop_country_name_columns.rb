class DropCountryNameColumns < ActiveRecord::Migration[7.1]
  def up
    remove_columns :users, :residence_country, :citizenship_country
    remove_columns :user_compliance_infos, :residence_country, :citizenship_country
    remove_column :companies, :country
    remove_column :company_role_applications, :country
    remove_column :invoices, :country
  end

  def down
    add_column :users, :residence_country, :string
    add_column :users, :citizenship_country, :string
    add_column :user_compliance_infos, :residence_country, :string
    add_column :user_compliance_infos, :citizenship_country, :string
    add_column :companies, :country, :string
    add_column :company_role_applications, :country, :string
    add_column :invoices, :country, :string
  end
end
