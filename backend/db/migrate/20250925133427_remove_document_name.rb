class RemoveDocumentName < ActiveRecord::Migration[8.0]
  def change
    up_only do
      Document.where(name: "1099-DIV").update_all(document_type: :form_1099div)
      Document.where(name: "1099-NEC").update_all(document_type: :form_1099nec)
      Document.where(name: "1042-S").update_all(document_type: :form_1042s)
      Document.where(name: "W-9").update_all(document_type: :form_w9)
      Document.where(name: "W-8BEN").update_all(document_type: :form_w8ben)
      Document.where(name: "W-8BEN-E").update_all(document_type: :form_w8bene)
    end
    remove_column :documents, :name, :string
  end
end
