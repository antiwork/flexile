class DropPgSearchDocuments < ActiveRecord::Migration[8.0]
  def change
    drop_table :pg_search_documents
  end
end
