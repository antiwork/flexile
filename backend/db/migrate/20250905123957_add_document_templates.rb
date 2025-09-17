class AddDocumentTemplates < ActiveRecord::Migration[8.0]
  def change
    create_table :document_templates do |t|
      t.integer :document_type, null: false
      t.belongs_to :company, null: false
      t.text :text, null: false
      t.timestamps
      t.index [:company_id, :document_type], unique: true
    end
    change_column_default :document_templates, :created_at, from: nil, to: -> { 'CURRENT_TIMESTAMP' }
    up_only do
      execute "INSERT INTO document_templates (document_type, company_id, text, created_at, updated_at) SELECT 1, id, exercise_notice, updated_at, updated_at FROM companies WHERE exercise_notice IS NOT NULL"
    end
    remove_column :companies, :exercise_notice, :text
  end
end
