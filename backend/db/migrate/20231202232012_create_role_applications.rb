class CreateRoleApplications < ActiveRecord::Migration[7.1]
  def change
    create_table :company_role_applications do |t|
      t.references :company_role, index: true, null: false
      t.string :name, null: false
      t.string :email, null: false
      t.string :country, null: false
      t.string :timezone, null: false
      t.text :description, null: false
      t.integer :hours_per_week, null: false
      t.integer :weeks_per_year, null: false
      t.integer :equity_percent, default: 0, null: false
      t.datetime :deleted_at
      t.timestamps
    end
    change_table :company_roles do |t|
      t.integer :capitalized_expense
      t.string :slug
      t.datetime :deleted_at
    end
    change_table :companies do |t|
      t.string :brand_color
      t.string :website
      t.text :description
      t.string :public_name
      t.string :slug
    end
    add_reference :company_contractors, :company_role, index: true
  end
end
