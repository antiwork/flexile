class AddCompanyIdToContract < ActiveRecord::Migration[7.1]
  def change
    add_reference :contracts, :company

    up_only do
      Contract.reset_column_information
      Contract.find_each do |contract|
        administrator = contract.company_administrator
        contract.update_columns(company_id: administrator.company_id)
      end
    end

    change_column_null :contracts, :company_id, false
  end
end
