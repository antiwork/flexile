# frozen_string_literal: true

class QuickbooksIntegrationSyncScheduleJob
  include Sidekiq::Job
  sidekiq_options retry: 5

  def perform(company_id)
    company = Company.find(company_id)
    integration = company.quickbooks_integration

    return if integration.nil? || integration.status_deleted?

    integration.status_active!

    contractors = company.company_workers.active
    return if contractors.none?

    # Enqueue workers sync job to match Inngest functionality
    active_worker_ids = contractors.pluck(:id)
    QuickbooksWorkersSyncJob.perform_async(company_id, active_worker_ids)
  end
end
