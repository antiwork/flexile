class AddNotNullToCompanyLawyerExternalId < ActiveRecord::Migration[7.2]
  def change
    CompanyLawyer.where(external_id: nil).find_each do |lawyer|
      ExternalId::ExternalIdGenerator.process(lawyer)
      lawyer.save!
    end
    change_column_null :company_lawyers, :external_id, false
  end
end
