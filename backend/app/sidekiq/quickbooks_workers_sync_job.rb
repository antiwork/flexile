# frozen_string_literal: true

class QuickbooksWorkersSyncJob
  include Sidekiq::Job
  sidekiq_options retry: 5

  def perform(company_id, active_worker_ids)
    company = Company.find(company_id)
    integration = company.quickbooks_integration

    return if integration.nil? || integration.status != "active"


    active_worker_ids.each do |worker_id|
      worker = CompanyWorker.find_by(id: worker_id)
      next unless worker&.ended_at.nil?

      IntegrationApi::Quickbooks.new(company_id: company_id).sync_data_for(object: worker)
    end


    integration.update!(last_sync_at: Time.current)
  end
end
