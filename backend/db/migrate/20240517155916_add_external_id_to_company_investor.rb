class AddExternalIdToCompanyInvestor < ActiveRecord::Migration[7.1]
  def change
    add_column :company_investors, :external_id, :string
  end
end
