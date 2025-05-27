class AddContractSignedElsewhereToCompanyContractors < ActiveRecord::Migration[8.0]
  def change
    add_column :company_contractors, :contract_signed_elsewhere, :boolean, default: false, null: false, comment: "Indicates if the contractor has already signed a contract elsewhere, negating the need for a Flexile consulting agreement"
  end
end
