# frozen_string_literal: true

class UpdateDocumentsForDocusealRemoval < ActiveRecord::Migration[8.0]
  def change
    add_column :documents, :text_content, :text
    remove_column :documents, :docuseal_submission_id, :integer
  end
end
