class CreateDocumentTemplates < ActiveRecord::Migration[7.2]
  def change
    create_table :document_templates do |t|
      t.references :company, null: false
      t.string :name, null: false
      t.integer :document_type, null: false
      t.string :external_id, null: false
      t.string :external_template_id, null: false

      t.timestamps
    end

    add_index :document_templates, :external_id, unique: true
    add_index :document_templates, :external_template_id, unique: true
    change_column_default :document_templates, :created_at, from: nil, to: -> { "CURRENT_TIMESTAMP" }
  end
end
