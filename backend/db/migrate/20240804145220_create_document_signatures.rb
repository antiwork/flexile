class CreateDocumentSignatures < ActiveRecord::Migration[7.1]
  def change
    create_table :document_signatures do |t|
      t.belongs_to :document, null: false 
      t.belongs_to :user, null: false
      t.string :signatory_title, null: false
      t.string :signature
      t.datetime :signed_at

      t.timestamps
    end
  end
end
