class ChangeUserToSigneeOnDocumentSignatures < ActiveRecord::Migration[7.1]
  def change
    remove_belongs_to :document_signatures, :user, null: false
    add_reference :document_signatures, :signable, null: false, polymorphic: true
  end
end
