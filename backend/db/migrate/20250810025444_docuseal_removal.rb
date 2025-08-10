class DocusealRemoval < ActiveRecord::Migration[8.0]
  def change
    drop_table :document_templates do |t|
      t.references :company, null: false
      t.string :name, null: false
      t.integer :document_type, null: false
      t.string :external_id, null: false
      t.datetime :created_at, default: -> { "CURRENT_TIMESTAMP" }, null: false
      t.datetime :updated_at, null: false
      t.boolean :signable, default: false, null: false
      t.bigint :docuseal_id, null: false
      t.index :external_id, unique: true
    end

    remove_column :documents, :docuseal_submission_id, :integer
    add_column :documents, :text_content, :text

    add_column :document_signatures, :signature, :text
  end
end
