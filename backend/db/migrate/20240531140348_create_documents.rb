class CreateDocuments < ActiveRecord::Migration[7.1]
  def change
    create_table :documents do |t|
      t.references :company, null: false
      t.references :user, null: false
      t.references :user_compliance_info
      t.references :company_administrator
      t.references :equity_grant

      t.string :name, null: false
      t.integer :document_type, null: false
      t.integer :year, null: false

      t.string :contractor_signature
      t.string :administrator_signature
      t.datetime :deleted_at
      t.datetime :emailed_at
      t.datetime :completed_at
      t.jsonb :json_data

      t.timestamps
    end
  end
end
