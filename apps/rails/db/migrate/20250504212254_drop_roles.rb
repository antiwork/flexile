class DropRoles < ActiveRecord::Migration[8.0]
  def change
    add_column :company_contractors, :role, :string
    up_only do
      execute "UPDATE company_contractors SET role = COALESCE((SELECT name FROM company_roles WHERE company_contractors.company_role_id = company_roles.id), '')"
    end
    change_column_null :company_contractors, :role, false
    remove_column :company_contractors, :company_role_id
    drop_table :company_roles do |t|
      t.references :company, null: false
      t.string :name, null: false
      t.datetime :created_at, default: -> { "CURRENT_TIMESTAMP" }, null: false
      t.datetime :updated_at, null: false
      t.integer :capitalized_expense
      t.string :slug
      t.datetime :deleted_at
      t.string :expense_account_id
      t.string :external_id, null: false, index: { unique: true }
    end
    drop_table :company_role_rates do |t|
      t.references :company, null: false
      t.integer :pay_rate_type, default: 0, null: false
      t.datetime :created_at, default: -> { "CURRENT_TIMESTAMP" }, null: false
      t.datetime :updated_at, null: false
      t.integer :pay_rate_in_subunits, null: false
      t.string :pay_rate_currency, default: "usd", null: false
    end
  end
end
