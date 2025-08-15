class RemoveDocuseal < ActiveRecord::Migration[8.0]
  def change
    drop_table :document_templates do |t|
      t.references :company
      t.string :name, null: false
      t.integer :document_type, null: false
      t.string :external_id, null: false
      t.datetime :created_at, default: -> { "CURRENT_TIMESTAMP" }, null: false
      t.datetime :updated_at, null: false
      t.boolean :signable, default: false, null: false
      t.bigint :docuseal_id, null: false
      t.index :external_id, unique: true
    end

    remove_column :documents, :json_data, :json
    remove_column :documents, :emailed_at, :datetime
    add_column :documents, :text, :string
    add_column :documents, :signed_at, :datetime
  end
end
