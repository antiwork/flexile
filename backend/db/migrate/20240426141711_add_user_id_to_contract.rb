class AddUserIdToContract < ActiveRecord::Migration[7.1]
  def change
    add_reference :contracts, :user

    up_only do
      Contract.reset_column_information
      Contract.find_each do |contract|
        contractor = contract.company_contractor
        contract.update_columns(user_id: contractor.user_id)
      end
    end

    change_column_null :contracts, :user_id, false
  end
end
