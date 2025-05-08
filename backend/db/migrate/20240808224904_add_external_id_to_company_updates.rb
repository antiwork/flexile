class AddExternalIdToCompanyUpdates < ActiveRecord::Migration[7.1]
  def change
    add_column :company_updates, :external_id, :string
  end
end
