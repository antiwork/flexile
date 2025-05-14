class AddExternalIdToCompanyContractor < ActiveRecord::Migration[7.1]
  def change
    add_column :company_contractors, :external_id, :string
  end
end
