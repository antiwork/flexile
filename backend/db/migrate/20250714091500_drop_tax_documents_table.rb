# db/migrate/20250714091500_drop_tax_documents_table.rb
class DropTaxDocumentsTable < ActiveRecord::Migration[8.0]
  def up
    # Drop the table and the enum type if they still exist
    drop_table :tax_documents, if_exists: true
    execute "DROP TYPE IF EXISTS tax_documents_status;"
  end

  def down
    raise ActiveRecord::IrreversibleMigration, "tax_documents table has been permanently removed"
  end
end
