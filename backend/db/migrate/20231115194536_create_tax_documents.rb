class CreateTaxDocuments < ActiveRecord::Migration[7.1]
  def up
    create_enum :tax_documents_status, %w[initialized submitted deleted]

    create_table :tax_documents do |t|
      t.string :name, null: false
      t.integer :tax_year, null: false
      t.enum :status, enum_type: :tax_documents_status, null: false, default: "initialized", index: true
      t.datetime :submitted_at
      t.datetime :emailed_at
      t.datetime :deleted_at
      t.references :user_compliance_info, null: false

      t.index %i[name tax_year user_compliance_info_id], unique: true, where: "status != 'deleted'"

      t.timestamps
    end
  end

  def down
    drop_table :tax_documents
    drop_enum :tax_documents_status
  end
end
