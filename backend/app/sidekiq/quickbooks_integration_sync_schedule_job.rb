# frozen_string_literal: true

class QuickbooksIntegrationSyncScheduleJob
  include Sidekiq::Job
  sidekiq_options retry: 5

  def perform(company_id)
    company = Company.find_by(id: company_id)
    return if company.nil?
    integration = company.quickbooks_integration

    return if integration.nil? || integration.status_deleted?

    integration.status_active!

    contractors = company.company_workers.active
    return if contractors.none?


    active_worker_ids = contractors.pluck(:id)
    active_worker_ids.each_slice(100) do |batch_ids|
      QuickbooksWorkersSyncJob.perform_async(company_id, batch_ids)
    end
  end
end
