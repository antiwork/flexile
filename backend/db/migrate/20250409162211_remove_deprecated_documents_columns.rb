class RemoveDeprecatedDocumentsColumns < ActiveRecord::Migration[8.0]
  def change
    remove_columns :documents, :company_administrator_id, :company_contractor_id, :administrator_signature, :contractor_signature, :user_id, :completed_at
  end
end
