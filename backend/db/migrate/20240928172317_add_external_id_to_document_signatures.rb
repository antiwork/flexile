class AddExternalIdToDocumentSignatures < ActiveRecord::Migration[7.2]
  def change
    add_column :document_signatures, :external_id, :string, null: false
    add_index :document_signatures, :external_id, unique: true
  end
end
