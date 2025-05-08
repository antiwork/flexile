class AddUserIdToDocumentSignatures < ActiveRecord::Migration[7.2]
  def change
    add_column :document_signatures, :user_id, :bigint
    add_index :document_signatures, :user_id
    DocumentSignature.reset_column_information
    DocumentSignature.find_each do |signature|
      signature.update_column(:user_id, signature.signable.user_id)
    end
    change_column_null :document_signatures, :user_id, false
  end
end
