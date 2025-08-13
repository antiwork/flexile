# frozen_string_literal: true

class UpdateDocument < ActiveRecord::Migration[8.0]
  def change
    add_column :documents, :text_content, :text
    add_column :document_signatures, :signature, :text
  end
end
