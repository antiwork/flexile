class DeleteLawyerDocuments < ActiveRecord::Migration[8.0]
  def change
    if reverting?
      change_column_default :document_signatures, :created_at, from: -> { "CURRENT_TIMESTAMP" }, to: nil
    end
    drop_table :document_signatures do |t|
      t.references :document, null: false
      t.string :signatory_title, null: false
      t.string :signature
      t.datetime :signed_at
      t.timestamps
      t.references :signable, null: false, polymorphic: true
      t.string :external_id, null: false
      t.references :user, null: false
    end
    remove_column :documents, :template, :text
  end
end
