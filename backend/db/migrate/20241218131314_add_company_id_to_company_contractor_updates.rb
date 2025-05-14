class AddCompanyIdToCompanyContractorUpdates < ActiveRecord::Migration[7.2]
  def change
    add_reference :company_contractor_updates, :company, index: true

    up_only do
      CompanyWorkerUpdate.reset_column_information
      CompanyWorkerUpdate.find_each do |update|
        update.update_columns(company_id: update.company_worker.company_id)
      end
    end

    change_column_null :company_contractor_updates, :company_id, false
  end
end
