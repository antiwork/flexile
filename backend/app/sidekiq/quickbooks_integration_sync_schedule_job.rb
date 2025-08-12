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

    contractors.each do |worker|
      QuickbooksDataSyncJob.perform_async(company_id, worker.class.name, worker.id)
    end

    integration.update!(last_sync_at: Time.current)
  end
end
