class AddDocusealSubmissionIdToDocuments < ActiveRecord::Migration[7.2]
  def change
    change_table :documents do |t|
      t.integer :docuseal_submission_id
      t.index :docuseal_submission_id
    end
  end
end
