# frozen_string_literal: true

class TaxFormReviewJob
  include Sidekiq::Worker
  sidekiq_options retry: 5

  BATCH_SIZE = 1_000

  def perform(tax_year = Date.current.year - 1, send_email = true)
    user_compliance_info_ids = Set.new
    company_ids = Set.new
    user_compliance_info_company_ids = Set.new

    collect_tax_form_data_for(CompanyWorker, tax_year, user_compliance_info_ids, company_ids, user_compliance_info_company_ids)
    collect_tax_form_data_for(CompanyInvestor, tax_year, user_compliance_info_ids, company_ids, user_compliance_info_company_ids)

    user_compliance_info_ids.each_slice(BATCH_SIZE) do |batch_ids|
      array_of_args = batch_ids.map { [_1, tax_year] }
      GenerateIrsTaxFormsJob.perform_bulk(array_of_args)
    end

    if send_email
      array_for_args = company_ids.map { [_1, tax_year] }
      CompanyAdministratorTaxFormReviewEmailJob.perform_bulk(array_for_args)

      user_compliance_info_company_ids.each_slice(BATCH_SIZE) do |batch_ids|
        array_of_args = batch_ids.map { |user_compliance_info_id, company_id| [user_compliance_info_id, company_id, tax_year] }
        UserTaxFormReviewReminderEmailJob.perform_bulk(array_of_args)
      end
    end
  end

  private
    def collect_tax_form_data_for(company_user_klass, tax_year, user_compliance_info_ids, company_ids, user_compliance_info_company_ids)
      UserComplianceInfo.alive
                        .joins(user: company_user_klass.model_name.plural.to_sym)
                        .merge(company_user_klass.with_required_tax_info_for(tax_year:))
                        .select(:id, "#{company_user_klass.table_name}.company_id")
                        .find_each do |record|
        user_compliance_info_ids.add(record.id)
        company_ids.add(record.company_id)
        user_compliance_info_company_ids.add([record.id, record.company_id])
      end
    end
end
