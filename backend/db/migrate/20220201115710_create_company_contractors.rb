class CreateCompanyContractors < ActiveRecord::Migration[7.0]
  def change
    create_table :company_contractors do |t|
      t.references :user, null: false, index: true
      t.references :company, null: false, index: true
      t.datetime :started_at, null: false
      t.integer :hours_per_week
      t.integer :hourly_rate_in_usd
      t.string :role

      t.timestamps
    end
  end
end
