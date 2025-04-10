class CreateNewDocumentSignatures < ActiveRecord::Migration[8.0]
  def up
    create_table :document_signatures do |t|
      t.belongs_to :document, null: false
      t.belongs_to :user, null: false
      t.string :title, null: false
      t.datetime :signed_at
      t.timestamps null: false
    end
    change_column_default :document_signatures, :created_at, from: nil, to: -> { "CURRENT_TIMESTAMP" }

    execute <<~SQL
      INSERT INTO document_signatures (document_id, user_id, title, signed_at)
      SELECT
        documents.id,
        company_administrators.user_id,
        'Company Representative',
        documents.completed_at
      FROM documents
      JOIN company_administrators ON company_administrators.id = documents.company_administrator_id
      WHERE documents.company_administrator_id IS NOT NULL
        AND documents.deleted_at IS NULL;

      INSERT INTO document_signatures (document_id, user_id, title, signed_at)
      SELECT
        documents.id,
        documents.user_id,
        'Signer',
        documents.completed_at
      FROM documents
      WHERE documents.deleted_at IS NULL;
    SQL
  end

  def down
    drop_table :document_signatures
  end
end
