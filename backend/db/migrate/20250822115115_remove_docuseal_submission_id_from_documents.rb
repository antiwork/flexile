class RemoveDocusealSubmissionIdFromDocuments < ActiveRecord::Migration[8.0]
  def change
    remove_index :documents, :docuseal_submission_id
    remove_column :documents, :docuseal_submission_id, :integer
  end
end
