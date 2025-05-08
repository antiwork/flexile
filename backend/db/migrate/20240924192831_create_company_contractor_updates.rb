class CreateCompanyContractorUpdates < ActiveRecord::Migration[7.2]
  def change
    create_table :company_contractor_updates do |t|
      t.references :company_contractor, null: false
      t.date :period_starts_on, null: false
      t.date :period_ends_on, null: false
      t.datetime :published_at
      t.datetime :deleted_at

      t.timestamps
    end

    add_index :company_contractor_updates, [:company_contractor_id, :period_starts_on], unique: true, name: "index_company_contractor_updates_on_contractor_and_period"
  end
end
