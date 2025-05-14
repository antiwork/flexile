class RemoveTitleUniquenessFromCompanyUpdates < ActiveRecord::Migration[7.1]
  def change
    remove_index :company_updates, name: "index_company_updates_on_title", unique: true
  end
end
