class CreateCompanyRoles < ActiveRecord::Migration[7.0]
  def change
    create_table :company_roles do |t|
      t.bigint :company_id, null: false
      t.text :job_description
      t.integer :hourly_rate_in_usd, null: false
      t.string :name, null: false
      t.boolean :actively_hiring

      t.timestamps
    end

    add_index :company_roles, :company_id
  end
end
