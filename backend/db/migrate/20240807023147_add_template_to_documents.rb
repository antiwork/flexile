class AddTemplateToDocuments < ActiveRecord::Migration[7.1]
  def change
    add_column :documents, :template, :text
  end
end
