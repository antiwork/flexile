class AddShareHoldingIdToDocuments < ActiveRecord::Migration[8.0]
  def change
    add_reference :documents, :share_holding, index: true
  end
end
