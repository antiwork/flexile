class AddSignaturesToContracts < ActiveRecord::Migration[7.0]
  def up
    add_column :contracts, :contractor_signature, :string
    add_column :contracts, :administrator_signature, :string

    Contract.reset_column_information
    Contract.find_each do |contract|
      contract.contractor_signature = contract.company_contractor.user.signature || contract.company_contractor.user.legal_name if contract.signed_at.present?
      contract.administrator_signature = contract.company_administrator.user.signature || contract.company_administrator.user.legal_name
      contract.save(validate: false)
    end

    change_column_null :contracts, :administrator_signature, false
  end

  def down
    remove_column :contracts, :contractor_signature
    remove_column :contracts, :administrator_signature
  end
end
