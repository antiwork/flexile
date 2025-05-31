class AddContractSignedElsewhereToCompanyContractors < ActiveRecord::Migration[8.0]
  def change
    add_column :company_contractors, :contract_signed_elsewhere, :boolean, default: false, null: false
  end
end
