class AddCompanyIdToCompanyContractorAbsences < ActiveRecord::Migration[7.2]
  def change
    add_reference :company_contractor_absences, :company, index: true

    up_only do
      CompanyWorkerAbsence.reset_column_information
      CompanyWorkerAbsence.find_each do |absence|
        absence.update_columns(company_id: absence.company_worker.company_id)
      end
    end

    change_column_null :company_contractor_absences, :company_id, false
  end
end
