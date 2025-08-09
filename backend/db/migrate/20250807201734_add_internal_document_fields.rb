class AddInternalDocumentFields < ActiveRecord::Migration[8.0]
  def change
    add_column :documents, :file_storage_key, :string
    add_column :documents, :signature_data, :jsonb
    add_column :documents, :status, :string, default: 'unsigned'
    add_column :documents, :is_template, :boolean, default: false
    add_column :documents, :created_from_template_id, :bigint
    
    add_index :documents, :file_storage_key
    add_index :documents, :status
    add_index :documents, :is_template
    add_index :documents, :created_from_template_id
  end
end
