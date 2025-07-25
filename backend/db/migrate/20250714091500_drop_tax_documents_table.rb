# frozen_string_literal: true

# db/migrate/20250714091500_drop_tax_documents_table.rb
class DropTaxDocumentsTable < ActiveRecord::Migration[8.0]
  def up
    # Drop the table and the enum type if they still exist
    drop_table :tax_documents, if_exists: true
    drop_enum :tax_documents_status, if_exists: true
  end

  def down
    # Recreate the enum and table structure (data cannot be restored)
    create_enum :tax_documents_status, %w[initialized submitted deleted]

    create_table :tax_documents do |t|
      t.string :name, null: false
      t.integer :tax_year, null: false
      t.enum :status, enum_type: :tax_documents_status, null: false, default: "initialized"
      t.datetime :submitted_at
      t.datetime :emailed_at
      t.datetime :deleted_at
      t.bigint :user_compliance_info_id, null: false
      t.datetime :created_at, default: -> { "CURRENT_TIMESTAMP" }, null: false
      t.datetime :updated_at, null: false
      t.bigint :company_id, null: false
    end

    add_index :tax_documents, :company_id
    add_index :tax_documents, %i[name tax_year user_compliance_info_id],
              unique: true,
              where: "(status <> 'deleted'::tax_documents_status)",
              name: "idx_on_name_tax_year_user_compliance_info_id_a24b2e6c51"
    add_index :tax_documents, :status
    add_index :tax_documents, :user_compliance_info_id
  end
end
