# frozen_string_literal: true

class QuickbooksIntegrationSyncScheduleJob
  include Sidekiq::Job
  sidekiq_options retry: 5

  def perform(company_id)
    company = Company.find(company_id)
    integration = company.quickbooks_integration

    return if integration.nil? || integration.status_deleted?

    integration.status_active!

    QuickbooksCompanyFinancialReportSyncJob.perform_async(company_id)

    contractors = company.company_workers.active
    return if contractors.none?

    array_of_args = contractors.map do |object|
      [company_id, object.class.name, object.id]
    end

    QuickbooksDataSyncJob.perform_bulk(array_of_args)
  end
end
