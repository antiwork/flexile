# frozen_string_literal: true

class QuickbooksIntegrationSyncScheduleJob
  include Sidekiq::Job
  sidekiq_options retry: 5

  BATCH_SIZE = 100

  def perform(company_id)
    company = Company.find_by(id: company_id)
    return if company.nil?
    integration = company.quickbooks_integration

    return if integration.nil? || integration.status_deleted?

    integration.status_active!

    contractors = company.company_workers.active
    return if contractors.none?



    contractors.select(:id).find_in_batches(batch_size: BATCH_SIZE) do |batch|
      QuickbooksWorkersSyncJob.perform_async(company_id, batch.map(&:id))
    end
  end
end
