class AddExternalIdToCompany < ActiveRecord::Migration[7.1]
  def change
    add_column :companies, :external_id, :string
  end
end
